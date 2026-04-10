import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AccessGrant, Customer, DigitalFile, Order, Product } from "@/lib/supabase/types";

export async function getCustomerDownloads(customerId: string) {
  const { data: grants, error } = await supabaseAdmin
    .from("access_grants")
    .select("*")
    .eq("customer_id", customerId)
    .eq("access_revoked", false)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const grantRows = (grants ?? []) as AccessGrant[];
  const productIds = [...new Set(grantRows.map((grant) => grant.product_id).filter(Boolean) as string[])];
  const fileIds = [...new Set(grantRows.map((grant) => grant.digital_file_id).filter(Boolean) as string[])];
  const orderIds = [...new Set(grantRows.map((grant) => grant.order_id).filter(Boolean) as string[])];

  const [{ data: products }, { data: files }, { data: orders }] = await Promise.all([
    productIds.length ? supabaseAdmin.from("products").select("*").in("id", productIds) : Promise.resolve({ data: [] }),
    fileIds.length ? supabaseAdmin.from("digital_files").select("*").in("id", fileIds) : Promise.resolve({ data: [] }),
    orderIds.length ? supabaseAdmin.from("orders").select("*").in("id", orderIds) : Promise.resolve({ data: [] })
  ]);

  return grantRows.map((grant) => ({
    grant,
    product: (products ?? []).find((product) => product.id === grant.product_id) as Product | undefined,
    file: (files ?? []).find((file) => file.id === grant.digital_file_id) as DigitalFile | undefined,
    order: (orders ?? []).find((order) => order.id === grant.order_id) as Order | undefined
  }));
}

export async function getDownloadGrantForCustomer(grantId: string, customer: Customer) {
  const { data: grant, error } = await supabaseAdmin
    .from("access_grants")
    .select("*")
    .eq("id", grantId)
    .eq("customer_id", customer.id)
    .eq("access_revoked", false)
    .maybeSingle();

  if (error || !grant) {
    throw new Error("Download access not found.");
  }

  const typedGrant = grant as AccessGrant;

  if (typedGrant.download_expiry_at && new Date(typedGrant.download_expiry_at) < new Date()) {
    throw new Error("This download link has expired.");
  }

  if (typedGrant.download_limit && typedGrant.download_count >= typedGrant.download_limit) {
    throw new Error("Download limit reached for this file.");
  }

  const { data: file, error: fileError } = await supabaseAdmin
    .from("digital_files")
    .select("*")
    .eq("id", typedGrant.digital_file_id ?? "")
    .single();

  if (fileError) {
    throw new Error(fileError.message);
  }

  return {
    grant: typedGrant,
    file: file as DigitalFile
  };
}

export async function markDownloadAccessed(grant: AccessGrant) {
  await supabaseAdmin
    .from("access_grants")
    .update({
      download_count: grant.download_count + 1,
      file_viewed: true,
      first_access_at: grant.first_access_at ?? new Date().toISOString(),
      last_access_at: new Date().toISOString()
    })
    .eq("id", grant.id);
}
