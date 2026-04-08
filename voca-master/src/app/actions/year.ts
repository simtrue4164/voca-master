'use server';

import { cookies } from 'next/headers';

export async function setAdminYear(year: string) {
  const cookieStore = await cookies();
  cookieStore.set('admin_year', year, { path: '/', maxAge: 60 * 60 * 24 * 365 });
}
