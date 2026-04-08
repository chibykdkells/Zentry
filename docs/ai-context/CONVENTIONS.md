# CONVENTIONS.md — Zentry Code Conventions

> Last updated: 2026-04-06
> These conventions are non-negotiable. Consistent code is maintainable code.
> Read this before writing any TypeScript, React, or NestJS code.

---

## TypeScript

- **Strict mode always.** `"strict": true` in all tsconfig files.
- **No `any`.** Use `unknown` if type is uncertain, then narrow it.
- **No type assertions (`as`)** unless genuinely unavoidable and commented.
- **Explicit return types** on all functions that are exported or non-trivial.
- **Interface over type** for object shapes. `type` for unions and aliases.
- **Enums from `packages/types`** — never redefine locally what's already shared.

```typescript
// CORRECT
interface CreateOrderDto {
  serviceId: string;
  submittedData: Record<string, string>;
}

// WRONG
const createOrder = (dto: any) => { ... }
```

---

## Naming

| Thing | Convention | Example |
|---|---|---|
| Files (TS) | kebab-case | `wallet.service.ts`, `order-card.tsx` |
| Files (React components) | kebab-case | `bottom-nav.tsx` |
| React components | PascalCase | `BottomNav`, `WalletCard` |
| Functions | camelCase | `createOrder()`, `formatNaira()` |
| Variables | camelCase | `walletBalance`, `orderId` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_PIN_ATTEMPTS` |
| NestJS services | PascalCase + `Service` suffix | `WalletService` |
| NestJS controllers | PascalCase + `Controller` suffix | `AuthController` |
| NestJS modules | PascalCase + `Module` suffix | `OrdersModule` |
| NestJS guards | PascalCase + `Guard` suffix | `JwtAuthGuard` |
| DTOs | PascalCase + `Dto` suffix | `CreateOrderDto` |
| Zod schemas | PascalCase + `Schema` suffix | `LoginSchema` |
| Interfaces | PascalCase, prefix `I` for Provider interfaces | `IPaymentProvider` |
| Enums | PascalCase | `OrderStatus`, `UserRole` |
| Enum values | SCREAMING_SNAKE_CASE | `IN_PROGRESS`, `CBT_CENTER` |

---

## NestJS Backend Conventions

### Module Structure
Every feature module follows this pattern:
```
module-name/
├── module-name.module.ts
├── module-name.controller.ts
├── module-name.service.ts
├── dto/
│   ├── create-thing.dto.ts
│   └── update-thing.dto.ts
└── module-name.spec.ts
```

### Controllers
- One controller per module
- Controller only handles HTTP concerns (parsing request, calling service, returning response)
- No business logic in controllers
- No direct Prisma calls in controllers
- All inputs validated via DTOs + ZodValidationPipe

```typescript
// CORRECT
@Post('create')
@Roles(UserRole.INDIVIDUAL)
async createOrder(
  @CurrentUser() user: JwtUser,
  @Body() dto: CreateOrderDto,
) {
  return this.ordersService.createOrder(user.sub, dto);
}

// WRONG — business logic in controller
@Post('create')
async createOrder(@Body() dto: any) {
  const wallet = await this.prisma.wallet.findUnique(...); // NO
  if (wallet.balance < dto.amount) throw new Error(); // NO
}
```

### Services
- Business logic lives here exclusively
- Services may call other services (inject via constructor)
- Services call Prisma via `PrismaService`
- Services call external APIs via Provider services (PAL)
- Services emit WebSocket events via `NotificationsService`
- Services never import from controllers

### Dependency Injection
Always inject via constructor:
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly walletService: WalletService,
  private readonly paymentService: PaymentService,
) {}
```

### Error Handling
Use NestJS built-in HTTP exceptions — never `throw new Error()`:
```typescript
throw new NotFoundException('Order not found');
throw new ForbiddenException('You cannot access this order');
throw new BadRequestException('Insufficient wallet balance');
throw new ConflictException('Order already claimed');
```

### DTOs
Use `class-validator` decorators on all DTOs:
```typescript
export class CreateOrderDto {
  @IsUUID()
  serviceId: string;

  @IsObject()
  @IsNotEmpty()
  submittedData: Record<string, string>;
}
```

---

## React / Next.js Frontend Conventions

### Component Structure
```typescript
// 1. Imports (external → internal → types)
import { useState } from 'react'
import { motion } from 'framer-motion'
import { formatNaira } from '@/lib/format'
import type { Order } from '@zentry/types'

// 2. Types/interfaces
interface OrderCardProps {
  order: Order;
  onSelect?: (id: string) => void;
}

// 3. Component (named export — no default exports for components)
export function OrderCard({ order, onSelect }: OrderCardProps) {
  // 4. Hooks first
  const [isExpanded, setIsExpanded] = useState(false)

  // 5. Derived values
  const isCompleted = order.status === 'COMPLETED'

  // 6. Handlers
  const handleSelect = () => onSelect?.(order.id)

  // 7. Return JSX
  return (...)
}
```

### No Default Exports for Components
```typescript
// CORRECT
export function WalletCard() { ... }

// WRONG
export default function WalletCard() { ... }
```

Exception: Next.js page files require default exports (framework requirement).

### Data Fetching
Use TanStack Query for all server state — never `useEffect` + `fetch`:
```typescript
// CORRECT
const { data, isLoading } = useQuery({
  queryKey: ['wallet', userId],
  queryFn: () => walletApi.getWallet(),
})

// WRONG
useEffect(() => {
  fetch('/api/wallet').then(...)
}, [])
```

### Mutations
```typescript
const { mutate, isPending } = useMutation({
  mutationFn: orderApi.createOrder,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    toast.success('Order placed successfully')
  },
  onError: (error) => {
    toast.error(error.message)
  },
})
```

### Forms
Always use React Hook Form + Zod resolver:
```typescript
const form = useForm<LoginInput>({
  resolver: zodResolver(LoginSchema),
  defaultValues: { email: '', password: '' }
})
```

### Loading States
Always show skeleton, never blank:
```typescript
if (isLoading) return <WalletCardSkeleton />
if (!data) return <EmptyState message="No wallet found" />
return <WalletCard data={data} />
```

### Error Boundaries
Wrap route groups in error boundaries. Never let an unhandled error crash the whole app.

### Styling
- Tailwind CSS only — no inline `style` props except for dynamic values
- Use `cn()` utility (repo-native utility in `@/lib/utils`) to merge class names:
  ```typescript
  cn('base-class', condition && 'conditional-class', className)
  ```
- No `!important` — if you need it, restructure the component
- Mobile-first: write base styles for mobile, then `md:` for desktop
- Shared brand values should come from the Tailwind 4 theme tokens defined in
  `apps/web/src/app/globals.css` instead of repeated raw hex values

### Zustand Stores
One file per concern. Keep stores small and focused:
```typescript
// stores/auth.store.ts
interface AuthStore {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  clearAuth: () => set({ user: null, accessToken: null }),
}))
```

---

## File & Folder Rules

- One component per file
- File name must match the exported component name (kebab-case)
- No barrel files (`index.ts`) for components — import directly
- Barrel files (`index.ts`) are acceptable in `packages/*` for public API

---

## API Response Consumption

The API always returns:
```typescript
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  timestamp: string;
}
```

The Axios interceptor unwraps this — components receive `data` directly
from TanStack Query. Do not access `response.data.data` in components.

---

## Comments

- Write comments for non-obvious logic only
- No commented-out code (delete it — git history exists)
- JSDoc on public utility functions in `packages/`
- Inline `// TODO:` allowed in development, not in production PRs
- Security-sensitive sections: comment why, not just what

---

## Import Order (auto-enforced by ESLint)

1. Node built-ins (`path`, `crypto`)
2. External packages (`react`, `next`, `framer-motion`)
3. Internal packages (`@zentry/types`, `@zentry/utils`)
4. App-level imports (`@/lib/...`, `@/components/...`)
5. Relative imports (`./wallet-card`)
6. Type imports (`import type { ... }`)

---

## Commit Message Format

```
type(scope): short description

Types: feat | fix | chore | docs | refactor | test | security
Scope: auth | wallet | orders | cbt | admin | providers | ui | db

Examples:
feat(orders): add order creation endpoint with escrow locking
fix(wallet): prevent negative balance on concurrent deductions
security(auth): rotate refresh token on every use
docs(ai-context): update PHASES.md after session 3
```
