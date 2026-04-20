// Barrel export file: re-exports the AdminDashboard component from the dashboard module
// This pattern allows other parts of the app to import from "@/components/features/admin"
// instead of the deeper path "@/components/features/admin/dashboard", keeping imports clean
// and providing a single entry point if more admin components are added later.
export { AdminDashboard } from "./dashboard";
