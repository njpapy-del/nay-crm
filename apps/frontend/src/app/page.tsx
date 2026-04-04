import { redirect } from 'next/navigation';

// Redirect racine vers dashboard ou login
export default function RootPage() {
  redirect('/dashboard');
}
