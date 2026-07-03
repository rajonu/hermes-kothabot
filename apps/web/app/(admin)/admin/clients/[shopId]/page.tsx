import { redirect } from 'next/navigation';

interface Props { params: Promise<{ shopId: string }> }

export default async function ClientShopRedirect({ params }: Props) {
  const { shopId } = await params;
  redirect(`/admin/shops/${shopId}`);
}
