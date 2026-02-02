# Project Structure

This project now follows a **clean separation of concerns** between routing and components:

## Overview

- **`app/` folder**: File-system routing (thin wrappers)
- **`components/` folder**: Actual UI logic and components
- **`types/` folder**: Shared TypeScript types
- **`lib/` folder**: Utility functions and helpers

## Structure

```
frontend/
├── app/                                    # Next.js routing (thin wrappers)
│   ├── layout.tsx
│   ├── page.tsx
│   ├── login/page.tsx
│   ├── admin/dashboard/page.tsx
│   ├── moderator/dashboard/page.tsx
│   ├── third-marker/dashboard/page.tsx
│   └── lecturer/
│       ├── layout.tsx
│       ├── dashboard/page.tsx              ← imports from components/features/lecturer
│       └── assessments/[assessmentId]/
│           ├── page.tsx                    ← imports from components/features/lecturer
│           └── upload/page.tsx             ← imports from components/features/lecturer
│
├── components/                             # Actual component logic
│   ├── ui/                                 # Reusable UI primitives
│   │   ├── index.ts                        # Barrel export
│   │   ├── utils.ts                        # cn() helper
│   │   ├── card.tsx
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── badge.tsx
│   │
│   └── features/                           # Feature-specific components
│       └── lecturer/
│           ├── index.ts                    # Barrel export
│           ├── dashboard.tsx               # LecturerDashboard component
│           ├── assessment-detail.tsx       # AssessmentDetail component
│           └── upload-marks.tsx            # UploadMarks component
│
├── types/                                  # Shared TypeScript types
│   └── assessment.ts
│
└── lib/                                    # Utilities and helpers
    └── assessment-utils.ts
```

## Benefits

### 1. **Clear Separation**
- **Routes** (`app/`) are thin wrappers - they only handle Next.js routing
- **Components** (`components/`) contain all the actual UI logic
- Easy to find and modify code without navigating deep folder structures

### 2. **Reusability**
- UI components in `components/ui/` can be used across all features
- Feature components can be imported anywhere
- No duplicate code (Button, Card, Badge, etc.)

### 3. **Type Safety**
- Centralized types in `types/` folder
- Shared utilities in `lib/` folder
- Consistent interfaces across the app

### 4. **Maintainability**
- Add new routes: just import existing components
- Modify UI: change component files, not scattered route files
- Test components independently from routing

### 5. **Next.js Benefits Preserved**
- File-system routing still works
- Server/Client components as needed
- Automatic code splitting
- Loading states and layouts

## Usage Examples

### Creating a new page:
```tsx
// app/new-feature/page.tsx
import { MyFeatureComponent } from "@/components/features/my-feature";

export default function NewFeaturePage() {
  return <MyFeatureComponent />;
}
```

### Using UI components:
```tsx
import { Card, Button, Badge } from "@/components/ui";

export function MyComponent() {
  return (
    <Card className="">
      <Button variant="outline">Click me</Button>
      <Badge variant="success">Active</Badge>
    </Card>
  );
}
```

### Path aliases:
- `@/components/*` → `components/*`
- `@/types/*` → `types/*`
- `@/lib/*` → `lib/*`

## Next Steps

1. **Add more feature components** as needed (moderator, admin, third-marker)
2. **Create shared layouts** in `components/layouts/`
3. **Add API utilities** in `lib/api/`
4. **Create hooks** in `hooks/` for shared logic

This structure scales well and keeps your codebase organized as it grows!
