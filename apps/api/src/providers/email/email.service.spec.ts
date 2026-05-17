import { EmailService } from './email.service';

describe('EmailService', () => {
  it('retries with the default sender when a custom sender is rejected', async () => {
    const provider = {
      providerName: 'RESEND',
      sendEmail: jest
        .fn()
        .mockResolvedValueOnce({
          messageId: '',
          accepted: false,
          errorMessage: 'This API key is not authorized to send emails from ecafe.app',
        })
        .mockResolvedValueOnce({
          messageId: 'fallback-message-id',
          accepted: true,
        }),
    };

    const service = new EmailService(provider as never);

    const result = await service.sendEmail({
      to: 'user@example.com',
      subject: 'Verify your email',
      html: '<p>OTP</p>',
      text: 'OTP',
      fromEmail: 'noreply@ecafe.app',
      fromName: 'E-Cafe',
    });

    expect(provider.sendEmail).toHaveBeenNthCalledWith(1, {
      to: 'user@example.com',
      subject: 'Verify your email',
      html: '<p>OTP</p>',
      text: 'OTP',
      fromEmail: 'noreply@ecafe.app',
      fromName: 'E-Cafe',
    });
    expect(provider.sendEmail).toHaveBeenNthCalledWith(2, {
      to: 'user@example.com',
      subject: 'Verify your email',
      html: '<p>OTP</p>',
      text: 'OTP',
    });
    expect(result).toEqual({
      messageId: 'fallback-message-id',
      accepted: true,
    });
  });

  it('does not retry when the initial send succeeds', async () => {
    const provider = {
      providerName: 'RESEND',
      sendEmail: jest.fn().mockResolvedValue({
        messageId: 'message-id',
        accepted: true,
      }),
    };

    const service = new EmailService(provider as never);

    const result = await service.sendEmail({
      to: 'user@example.com',
      subject: 'Verify your email',
      html: '<p>OTP</p>',
      fromEmail: 'noreply@ecafe.app',
      fromName: 'E-Cafe',
    });

    expect(provider.sendEmail).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      messageId: 'message-id',
      accepted: true,
    });
  });
});
