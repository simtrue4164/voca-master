import { cookies } from 'next/headers';

export async function getAdminYear(): Promise<number> {
  const cookieStore = await cookies();
  const val = cookieStore.get('admin_year')?.value;
  const parsed = val ? parseInt(val, 10) : NaN;
  return isNaN(parsed) ? new Date().getFullYear() : parsed;
}
