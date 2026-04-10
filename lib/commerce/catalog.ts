import { cache } from "react";

import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  Category,
  CategoryFeaturedProduct,
  HomepageSection,
  ProductReview,
  ProductWithRelations,
  StorePolicies,
  StoreSettings
} from "@/lib/supabase/types";

export const getStoreSettings = cache(async () => {
  if (!env.isSupabaseConfigured) {
    return {
      store: {
        id: "local-store",
        store_name: env.appName,
        logo_url: env.appLogoUrl,
        support_email: null,
        support_phone: null,
        whatsapp_number: null,
        guest_checkout_enabled: true,
        account_creation_required: false,
        tax_inclusive_pricing: false,
        auto_invoice_generation: true,
        default_currency: "INR",
        timezone: "Asia/Kolkata",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as StoreSettings,
      policies: null
    };
  }

  const [{ data: store }, { data: policies }] = await Promise.all([
    supabaseAdmin.from("store_settings").select("*").order("created_at").limit(1).maybeSingle(),
    supabaseAdmin.from("store_policies").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle()
  ]);

  const fallbackStore: StoreSettings = {
    id: "local-store",
    store_name: env.appName,
    logo_url: env.appLogoUrl,
    support_email: null,
    support_phone: null,
    whatsapp_number: null,
    guest_checkout_enabled: true,
    account_creation_required: false,
    tax_inclusive_pricing: false,
    auto_invoice_generation: true,
    default_currency: "INR",
    timezone: "Asia/Kolkata",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  return {
    store: (store ?? fallbackStore) as StoreSettings,
    policies: (policies ?? null) as StorePolicies | null
  };
});

export const getVisibleCategories = cache(async () => {
  if (!env.isSupabaseConfigured) {
    return [] as Category[];
  }

  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Category[];
});

export async function getProductsByIds(productIds: string[]) {
  if (!env.isSupabaseConfigured) {
    return [] as ProductWithRelations[];
  }

  if (!productIds.length) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*, product_media(*), product_variants(*), categories(*)")
    .in("id", productIds)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  return productIds
    .map((id) => (data ?? []).find((product) => product.id === id))
    .filter(Boolean) as ProductWithRelations[];
}

export const getHomepageData = cache(async () => {
  const [{ store, policies }, categories, homepageSectionsRaw] = await Promise.all([
    getStoreSettings(),
    getVisibleCategories(),
    supabaseAdmin.from("homepage_sections").select("*").eq("is_active", true).order("sort_order")
  ]);

  const homepageSections = (homepageSectionsRaw.data ?? []) as HomepageSection[];
  const sections = await Promise.all(
    homepageSections.map(async (section) => ({
      section,
      products: await getProductsByIds(section.product_ids ?? [])
    }))
  );

  return {
    store,
    policies,
    categories,
    featuredCategories: categories.filter((category) => category.is_featured).slice(0, 6),
    sections
  };
});

export async function getCatalogData(query?: string, categoryId?: string) {
  if (!env.isSupabaseConfigured) {
    return [] as ProductWithRelations[];
  }

  let request = supabaseAdmin
    .from("products")
    .select("*, product_media(*), categories(*)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (query) {
    request = request.or(`name.ilike.%${query}%,short_description.ilike.%${query}%`);
  }

  if (categoryId) {
    request = request.eq("category_id", categoryId);
  }

  const { data, error } = await request;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProductWithRelations[];
}

export async function getCategoryPageData(slug: string) {
  if (!env.isSupabaseConfigured) {
    return null;
  }

  const { data: category, error } = await supabaseAdmin
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .eq("is_visible", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!category) {
    return null;
  }

  const [products, featuredRaw] = await Promise.all([
    getCatalogData(undefined, category.id),
    supabaseAdmin
      .from("category_featured_products")
      .select("*")
      .eq("category_id", category.id)
      .order("sort_order")
  ]);

  const featuredLinks = (featuredRaw.data ?? []) as CategoryFeaturedProduct[];
  const featuredProducts = await getProductsByIds(featuredLinks.map((item) => item.product_id));

  return {
    category: category as Category,
    products,
    featuredProducts
  };
}

export async function getProductPageData(slug: string) {
  if (!env.isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*, product_media(*), product_variants(*), digital_files(*), categories(*)")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const [reviews, relatedProducts] = await Promise.all([
    getProductReviews(data.id),
    getCatalogData(undefined, data.category_id ?? undefined)
  ]);

  return {
    product: data as ProductWithRelations,
    reviews,
    relatedProducts: relatedProducts.filter((item) => item.id !== data.id).slice(0, 4)
  };
}

export async function getProductReviews(productId: string) {
  if (!env.isSupabaseConfigured) {
    return [] as ProductReview[];
  }

  const { data, error } = await supabaseAdmin
    .from("product_reviews")
    .select("*, customers(id, first_name, last_name, full_name, profile_image), product_review_media(*)")
    .eq("product_id", productId)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.toLowerCase().includes("product_reviews")) {
      return [] as ProductReview[];
    }

    throw new Error(error.message);
  }

  return (data ?? []).map((review) => ({
    ...review,
    customer: review.customers,
    media: (review.product_review_media ?? []).sort(
      (left: { sort_order: number }, right: { sort_order: number }) => left.sort_order - right.sort_order
    )
  })) as ProductReview[];
}
