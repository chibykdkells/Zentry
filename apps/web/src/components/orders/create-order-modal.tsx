'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Upload } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { FeedbackBanner } from '@/components/shared/feedback-banner';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  useVtuCablePlans,
  useVtuDataPlans,
  type ServiceCatalogItem,
  type VtuCablePlan,
  type VtuDataPlan,
  type VtuIntegrationMeta,
} from '@/hooks/use-service-catalog';
import { formatNaira } from '@/lib/format';
import {
  cleanupOrderUploads,
  uploadOrderFiles,
  type UploadedOrderFile,
} from '@/lib/order-file-uploads';
import { cn } from '@/lib/utils';

interface CreateOrderModalProps {
  open: boolean;
  service: ServiceCatalogItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateOrderModal({
  open,
  service,
  onClose,
  onSuccess,
}: CreateOrderModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [documentFiles, setDocumentFiles] = useState<Record<string, File | null>>(
    {},
  );
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [verifyingCable, setVerifyingCable] = useState(false);
  const [verifyingMeter, setVerifyingMeter] = useState(false);
  const [cableVerification, setCableVerification] = useState<{
    customerName: string;
    currentPlan?: string | null;
    dueDate?: string | null;
    integration?: VtuIntegrationMeta | null;
  } | null>(null);
  const [meterVerification, setMeterVerification] = useState<{
    customerName: string;
    address?: string | null;
    meterType: string;
    integration?: VtuIntegrationMeta | null;
  } | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const requiredFields = useMemo(
    () => service?.requiredFields ?? [],
    [service],
  );
  const requiredDocuments = useMemo(
    () => service?.requiredDocuments ?? [],
    [service],
  );
  const isAutomatedService = service?.deliveryMode === 'API_AUTOMATED';
  const isAirtimeService = service?.category.slug === 'vtu-airtime';
  const isDataService = service?.category.slug === 'vtu-data';
  const isCableService = service?.category.slug === 'vtu-cable';
  const isElectricityService = service?.category.slug === 'vtu-electricity';
  const {
    plans: dataPlans,
    integration: dataIntegration,
    loading: dataPlansLoading,
    error: dataPlansError,
  } = useVtuDataPlans(service?.id ?? '', open && Boolean(service && isDataService));
  const {
    plans: cablePlans,
    integration: cablePlanIntegration,
    loading: cablePlansLoading,
    error: cablePlansError,
  } = useVtuCablePlans(
    service?.id ?? '',
    open && Boolean(service && isCableService),
  );
  const selectedPlan = useMemo(
    () => dataPlans.find((plan: VtuDataPlan) => plan.code === values.planCode),
    [dataPlans, values.planCode],
  );
  const selectedCablePlan = useMemo(
    () =>
      cablePlans.find(
        (plan: VtuCablePlan) => plan.code === values.bouquetCode,
      ),
    [cablePlans, values.bouquetCode],
  );

  useEffect(() => {
    if (!open || !service) {
      setValues({});
      setDocumentFiles({});
      setInlineError(null);
      setVerificationError(null);
      setCableVerification(null);
      setMeterVerification(null);
      return;
    }

    const defaults = requiredFields.reduce<Record<string, string>>(
      (accumulator, field) => {
        accumulator[field.name] = '';
        return accumulator;
      },
      {},
    );
    const documentDefaults = requiredDocuments.reduce<Record<string, File | null>>(
      (accumulator, document) => {
        accumulator[document.name] = null;
        return accumulator;
      },
      {},
    );

    setValues(defaults);
    setDocumentFiles(documentDefaults);
    setInlineError(null);
    setVerificationError(null);
    setCableVerification(null);
    setMeterVerification(null);
  }, [open, requiredDocuments, requiredFields, service]);

  if (!open || !service) {
    return null;
  }

  const estimatedAutomatedTotal = (() => {
    if (isAirtimeService) {
      const amountNaira = Number(values.amountNaira ?? values.amount);

      if (Number.isFinite(amountNaira) && amountNaira > 0) {
        return String(Math.round(amountNaira * 100) + Number(service.totalPrice));
      }
    }

    if (isDataService && selectedPlan) {
      return String(Number(selectedPlan.amountKobo) + Number(service.totalPrice));
    }

    if (isCableService && selectedCablePlan) {
      return String(
        Number(selectedCablePlan.amountKobo) + Number(service.totalPrice),
      );
    }

    if (isElectricityService) {
      const amountNaira = Number(values.amountNaira ?? values.amount);

      if (Number.isFinite(amountNaira) && amountNaira > 0) {
        return String(Math.round(amountNaira * 100) + Number(service.totalPrice));
      }
    }

    return service.totalPrice;
  })();

  const handleValueChange = (name: string, value: string) => {
    setValues((current) => ({
      ...current,
      [name]: value,
    }));
    setInlineError(null);

    if (name === 'smartcardNumber') {
      setCableVerification(null);
      setVerificationError(null);
    }

    if (name === 'meterNumber' || name === 'meterType') {
      setMeterVerification(null);
      setVerificationError(null);
    }
  };

  const handleVerifyCable = async () => {
    if (!service) return;

    const smartcardNumber = values.smartcardNumber?.trim();

    if (!smartcardNumber) {
      setVerificationError('Enter the smartcard or IUC number first.');
      return;
    }

    setVerifyingCable(true);
    setVerificationError(null);

    try {
      const response = await apiClient.post<{
        data: {
          customerName: string;
          currentPlan?: string | null;
          dueDate?: string | null;
          integration?: VtuIntegrationMeta | null;
        };
      }>(`/services/vtu/cable-verify/${service.id}`, {
        smartcardNumber,
      });

      setCableVerification(response.data.data);
      toast.success('Smartcard verified successfully.');
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        'We could not verify this smartcard right now.',
      );
      setCableVerification(null);
      setVerificationError(message);
      toast.error(message);
    } finally {
      setVerifyingCable(false);
    }
  };

  const handleVerifyMeter = async () => {
    if (!service) return;

    const meterNumber = values.meterNumber?.trim();
    const meterType = values.meterType?.trim().toUpperCase();

    if (!meterNumber || !meterType) {
      setVerificationError(
        'Enter the meter number and choose the meter type first.',
      );
      return;
    }

    setVerifyingMeter(true);
    setVerificationError(null);

    try {
      const response = await apiClient.post<{
        data: {
          customerName: string;
          address?: string | null;
          meterType: string;
          integration?: VtuIntegrationMeta | null;
        };
      }>(`/services/vtu/electricity-verify/${service.id}`, {
        meterNumber,
        meterType,
      });

      setMeterVerification(response.data.data);
      toast.success('Meter verified successfully.');
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        'We could not verify this meter right now.',
      );
      setMeterVerification(null);
      setVerificationError(message);
      toast.error(message);
    } finally {
      setVerifyingMeter(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setInlineError(null);
    let uploadedItems: UploadedOrderFile[] = [];

    try {
      if (isCableService && !cableVerification) {
        throw new Error(
          'Please verify the smartcard number before completing this purchase.',
        );
      }

      if (isElectricityService && !meterVerification) {
        throw new Error(
          'Please verify the meter number before completing this purchase.',
        );
      }

      const missingDocuments = requiredDocuments
        .filter((document) => document.required !== false)
        .filter((document) => !documentFiles[document.name])
        .map((document) => document.label ?? document.name);

      if (missingDocuments.length > 0) {
        throw new Error(
          `Please attach these required documents: ${missingDocuments.join(', ')}`,
        );
      }

      const selectedDocuments = requiredDocuments.flatMap((document) => {
        const file = documentFiles[document.name];

        return file ? [{ document, file }] : [];
      });
      let requesterDocuments: Record<
        string,
        {
          url: string;
          filename: string | null;
          publicId: string | null;
        }
      > = {};

      if (selectedDocuments.length > 0) {
        uploadedItems = await uploadOrderFiles(
          selectedDocuments.map((entry) => entry.file),
        );

        requesterDocuments = Object.fromEntries(
          uploadedItems.map((item, index) => [
            selectedDocuments[index]!.document.name,
            {
              url: item.url,
              filename:
                item.filename ?? selectedDocuments[index]!.file.name ?? null,
              publicId: item.publicId ?? null,
            },
          ]),
        );
      }

      const response = await apiClient.post<{ message: string }>('/orders', {
        serviceId: service.id,
        submittedData: values,
        requesterDocuments,
      });

      toast.success(response.data.message);
      onSuccess?.();
      onClose();
    } catch (error) {
      if (uploadedItems.length > 0) {
        await cleanupOrderUploads(uploadedItems).catch(() => undefined);
      }

      const message =
        error instanceof Error && error.message
          ? error.message
          : getApiErrorMessage(
              error,
              'We could not place that order right now.',
            );

      setInlineError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-6">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-slate-200 bg-white shadow-2xl sm:rounded-[2rem]" style={{ maxHeight: 'calc(100dvh - 2rem)' }}>

          {/* Pinned header */}
          <div className="shrink-0 flex items-start justify-between gap-4 px-6 pt-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
                New request
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                {service.name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {service.description ??
                  'Complete the guided details below to place this request.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 pb-2 pt-6">

        <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
          <InfoPill label="Category" value={service.category.name} />
          <InfoPill
            label={isAutomatedService ? 'Estimated charge' : 'Price'}
            value={formatNaira(estimatedAutomatedTotal)}
          />
          <InfoPill
            label="Documents"
            value={
              requiredDocuments.length
                ? `${requiredDocuments.length} required`
                : 'No upload needed'
            }
          />
        </div>

        <div className="mt-6 space-y-4">
          {requiredFields.length === 0 ? (
            <FeedbackBanner
              tone="info"
              title={isAutomatedService ? 'Instant delivery' : 'Quick request'}
              message={
                isAutomatedService
                  ? 'This service is delivered directly by the connected provider. Once you confirm the purchase, the wallet charge happens immediately and the result returns to your order history without entering the CBT queue.'
                  : 'This service does not require any custom input yet. Placing the order will move the service amount into funds on hold immediately.'
              }
            />
          ) : (
            requiredFields.map((field) => (
              <label key={field.name} className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  {field.label ?? field.name}
                  {field.required ? ' *' : ''}
                </span>
                {field.name === 'planCode' && isDataService ? (
                  <select
                    value={values[field.name] ?? ''}
                    onChange={(event) =>
                      handleValueChange(field.name, event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                  >
                    <option value="">
                      {dataPlansLoading ? 'Loading plans...' : 'Select a data plan'}
                    </option>
                    {dataPlans.map((plan) => (
                      <option key={plan.code} value={plan.code}>
                        {plan.name} • {formatNaira(plan.amountKobo)} • {plan.validity}
                      </option>
                    ))}
                  </select>
                ) : field.name === 'bouquetCode' && isCableService ? (
                  <select
                    value={values[field.name] ?? ''}
                    onChange={(event) =>
                      handleValueChange(field.name, event.target.value)
                    }
                    disabled={!cableVerification}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">
                      {cablePlansLoading
                        ? 'Loading bouquets...'
                        : cableVerification
                          ? 'Select a bouquet'
                          : 'Verify smartcard first'}
                    </option>
                    {cablePlans.map((plan) => (
                      <option key={plan.code} value={plan.code}>
                        {plan.name} • {formatNaira(plan.amountKobo)} • {plan.duration}
                      </option>
                    ))}
                  </select>
                ) : field.name === 'meterType' && isElectricityService ? (
                  <select
                    value={values[field.name] ?? ''}
                    onChange={(event) =>
                      handleValueChange(field.name, event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                  >
                    <option value="">Choose meter type</option>
                    <option value="PREPAID">Prepaid</option>
                    <option value="POSTPAID">Postpaid</option>
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    rows={4}
                    value={values[field.name] ?? ''}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      handleValueChange(field.name, event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={values[field.name] ?? ''}
                    onChange={(event) =>
                      handleValueChange(field.name, event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                  >
                    <option value="">
                      {field.placeholder ?? `Select ${field.label ?? field.name}`}
                    </option>
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={
                      field.type === 'number'
                        ? 'number'
                        : field.type === 'email'
                          ? 'email'
                          : field.type === 'tel'
                            ? 'tel'
                            : 'text'
                    }
                    value={values[field.name] ?? ''}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      handleValueChange(field.name, event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/10"
                  />
                )}
                {field.helpText ? (
                  <span className="mt-2 block text-xs leading-5 text-slate-500">
                    {field.helpText}
                  </span>
                ) : null}
                {field.name === 'planCode' && isDataService && selectedPlan ? (
                  <span className="mt-2 block text-xs leading-5 text-slate-500">
                    Selected plan charge: {formatNaira(selectedPlan.amountKobo)}.
                    Your estimate above already includes the service fee.
                  </span>
                ) : field.name === 'bouquetCode' &&
                  isCableService &&
                  selectedCablePlan ? (
                  <span className="mt-2 block text-xs leading-5 text-slate-500">
                    Selected bouquet charge:{' '}
                    {formatNaira(selectedCablePlan.amountKobo)} for{' '}
                    {selectedCablePlan.duration}.
                  </span>
                ) : null}
                {field.name === 'smartcardNumber' && isCableService ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleVerifyCable}
                      disabled={verifyingCable}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {verifyingCable ? 'Verifying...' : 'Verify smartcard'}
                    </button>
                    {cableVerification ? (
                      <span className="text-xs font-medium text-emerald-700">
                        Verified for {cableVerification.customerName}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {field.name === 'meterNumber' && isElectricityService ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleVerifyMeter}
                      disabled={verifyingMeter}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {verifyingMeter ? 'Verifying...' : 'Verify meter'}
                    </button>
                    {meterVerification ? (
                      <span className="text-xs font-medium text-emerald-700">
                        Verified for {meterVerification.customerName}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </label>
            ))
          )}
        </div>

        {dataPlansError || cablePlansError ? (
          <FeedbackBanner
            tone="warning"
            title="Service setup unavailable"
            message={dataPlansError ?? cablePlansError ?? 'Service setup could not be loaded.'}
            className="mt-4"
          />
        ) : null}

        {isAutomatedService &&
        ((isDataService && dataIntegration) ||
          (isCableService && cablePlanIntegration) ||
          (isElectricityService &&
            (meterVerification?.integration ?? cableVerification?.integration))) ? (
          <FeedbackBanner
            tone="info"
            title="Provider status"
            message={(() => {
              const integration =
                (isDataService ? dataIntegration : null) ??
                (isCableService ? cablePlanIntegration : null) ??
                meterVerification?.integration ??
                cableVerification?.integration ??
                null;

              if (!integration) {
                return 'Provider status is available when this service is loaded.';
              }

              const modeLabel =
                integration.mode === 'mock'
                  ? 'sandboxed mock delivery'
                  : 'live provider delivery';
              const cacheLabel = integration.cached
                ? 'using a cached provider lookup'
                : 'using a fresh provider lookup';

              return `${integration.name} is currently serving this flow with ${modeLabel}, ${cacheLabel}.`;
            })()}
            className="mt-4"
          />
        ) : null}

        {verificationError ? (
          <FeedbackBanner
            tone="warning"
            title="Verification needed"
            message={verificationError}
            className="mt-4"
          />
        ) : null}

        {isCableService && cableVerification ? (
          <FeedbackBanner
            tone="success"
            title="Smartcard verified"
            message={`Account name: ${cableVerification.customerName}${cableVerification.currentPlan ? ` • Current package: ${cableVerification.currentPlan}` : ''}${cableVerification.dueDate ? ` • Due date: ${cableVerification.dueDate}` : ''}`}
            className="mt-4"
          />
        ) : null}

        {isElectricityService && meterVerification ? (
          <FeedbackBanner
            tone="success"
            title="Meter verified"
            message={`Meter owner: ${meterVerification.customerName}${meterVerification.address ? ` • ${meterVerification.address}` : ''}`}
            className="mt-4"
          />
        ) : null}

        {requiredDocuments.length ? (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-brand-navy shadow-sm">
                <Upload size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Required documents
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Upload the supporting documents needed for this request before
                  it moves into {isAutomatedService ? 'processing' : 'funds on hold'}.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {requiredDocuments.map((document) => (
                <label key={document.name} className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    {document.label ?? document.name}
                    {document.required !== false ? ' *' : ''}
                  </span>
                  {document.description ? (
                    <span className="mb-2 block text-xs leading-5 text-slate-500">
                      {document.description}
                    </span>
                  ) : null}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(event) =>
                      setDocumentFiles((current) => ({
                        ...current,
                        [document.name]: event.target.files?.[0] ?? null,
                      }))
                    }
                    className="block w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                  />
                  <span className="mt-2 block text-xs text-slate-400">
                    Accepts PDF, JPG, PNG, or WEBP up to 5MB.
                    {document.acceptedTypes?.length
                      ? ` Preferred: ${document.acceptedTypes.join(', ')}.`
                      : ''}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {inlineError ? (
          <FeedbackBanner
            tone="error"
            title="Order could not be placed"
            message={inlineError}
            className="mt-4"
          />
        ) : null}

          </div>{/* end scrollable body */}

          {/* Pinned footer */}
          <div className="shrink-0 border-t border-slate-100 px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-navy px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-navy-strong',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {submitting
              ? isAutomatedService
                ? 'Processing purchase...'
                : 'Placing order...'
              : isAutomatedService
                ? 'Confirm purchase'
                : 'Place order'}
          </button>
            </div>
          </div>

      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
