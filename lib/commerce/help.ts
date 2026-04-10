import { cache } from "react";

import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { FAQ, HelpArticle, ProductWithRelations } from "@/lib/supabase/types";

const GUIDE_CATEGORY_PATTERNS = ["guide", "how", "tutorial", "docs", "documentation"];

function isGuideArticle(article: HelpArticle) {
  const category = article.category?.toLowerCase() || "";
  return GUIDE_CATEGORY_PATTERNS.some((pattern) => category.includes(pattern));
}

async function loadPublishedHelpArticles() {
  if (!env.isSupabaseConfigured) {
    return [] as HelpArticle[];
  }

  const { data, error } = await supabaseAdmin
    .from("help_articles")
    .select("*")
    .eq("is_published", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as HelpArticle[];
}

export const getAllPublishedHelpArticles = cache(loadPublishedHelpArticles);

export const getAllFaqs = cache(async () => {
  if (!env.isSupabaseConfigured) {
    return [] as FAQ[];
  }

  const { data, error } = await supabaseAdmin.from("faqs").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as FAQ[];
});

export const getGuides = cache(async () => {
  const articles = await getAllPublishedHelpArticles();
  return articles.filter(isGuideArticle);
});

export const getHelpArticles = cache(async () => {
  const articles = await getAllPublishedHelpArticles();
  return articles.filter((article) => !isGuideArticle(article));
});

export async function getHelpArticleBySlug(slug: string) {
  const articles = await getAllPublishedHelpArticles();
  return articles.find((article) => article.slug === slug) ?? null;
}

export async function getGuideBySlug(slug: string) {
  const guides = await getGuides();
  return guides.find((guide) => guide.slug === slug) ?? null;
}

export async function getFaqBySlug(slug: string) {
  const faqs = await getAllFaqs();
  return faqs.find((faq) => faq.seo_slug === slug) ?? null;
}

async function getRelatedArticles(article: HelpArticle) {
  if (!env.isSupabaseConfigured) {
    return [] as HelpArticle[];
  }

  const { data, error } = await supabaseAdmin
    .from("help_article_relations")
    .select("related_article_id")
    .eq("article_id", article.id)
    .order("sort_order");

  if (error) {
    throw new Error(error.message);
  }

  const relatedIds = (data ?? []).map((entry) => entry.related_article_id as string).filter(Boolean);
  if (!relatedIds.length) {
    const articles = await getAllPublishedHelpArticles();
    return articles.filter((candidate) => candidate.id !== article.id).slice(0, 4);
  }

  const articles = await getAllPublishedHelpArticles();
  return relatedIds
    .map((id) => articles.find((candidate) => candidate.id === id))
    .filter(Boolean) as HelpArticle[];
}

async function getRelatedProducts(article: HelpArticle) {
  if (!env.isSupabaseConfigured) {
    return [] as ProductWithRelations[];
  }

  const searchTerms = [...new Set([...(article.tags ?? []), ...(article.keywords ?? []), article.category].filter(Boolean))];
  if (!searchTerms.length) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*, product_media(*), categories(*)")
    .eq("status", "active")
    .limit(40);

  if (error) {
    return [];
  }

  const products = (data ?? []) as ProductWithRelations[];
  return products
    .filter((product) => {
      const haystack = [
        product.name,
        product.short_description,
        product.full_description,
        ...(product.tags ?? []),
        product.categories?.name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchTerms.some((term) => haystack.includes(String(term).toLowerCase()));
    })
    .slice(0, 4);
}

async function getHelpfulCounts(articleId: string) {
  if (!env.isSupabaseConfigured) {
    return { helpful: 0, notHelpful: 0 };
  }

  const { data, error } = await supabaseAdmin
    .from("help_article_feedback")
    .select("is_helpful")
    .eq("article_id", articleId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce(
    (accumulator, item) => {
      if (item.is_helpful) {
        accumulator.helpful += 1;
      } else {
        accumulator.notHelpful += 1;
      }
      return accumulator;
    },
    { helpful: 0, notHelpful: 0 }
  );
}

export async function getHelpArticlePageData(slug: string, kind: "help" | "guides") {
  const article = kind === "guides" ? await getGuideBySlug(slug) : await getHelpArticleBySlug(slug);

  if (!article) {
    return null;
  }

  const [rawRelatedArticles, relatedProducts, feedback] = await Promise.all([
    getRelatedArticles(article),
    getRelatedProducts(article),
    getHelpfulCounts(article.id)
  ]);

  const relatedArticles =
    kind === "guides" ? rawRelatedArticles.filter(isGuideArticle) : rawRelatedArticles.filter((item) => !isGuideArticle(item));

  return {
    article,
    relatedArticles,
    relatedProducts,
    feedback
  };
}

export async function getFaqPageData(slug: string) {
  const faq = await getFaqBySlug(slug);
  if (!faq) {
    return null;
  }

  const faqs = await getAllFaqs();
  return {
    faq,
    relatedFaqs: faqs.filter((item) => item.id !== faq.id).slice(0, 6)
  };
}

export async function searchHelpContent(query: string) {
  const term = query.trim().toLowerCase();
  if (!term) {
    return {
      articles: [] as HelpArticle[],
      faqs: [] as FAQ[],
      seoPages: [] as Array<{ title: string; url: string; type: string; description: string }>
    };
  }

  const [articles, faqs] = await Promise.all([getAllPublishedHelpArticles(), getAllFaqs()]);

  const articleMatches = articles.filter((article) =>
    [article.title, article.category, article.content, ...(article.tags ?? []), ...(article.keywords ?? [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  );

  const faqMatches = faqs.filter((faq) =>
    [faq.question, faq.answer, faq.category, ...(faq.tags ?? [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  );

  let products: Array<{ name: string; slug: string; short_description: string | null }> = [];
  let categories: Array<{ name: string; slug: string; description: string | null }> = [];

  if (env.isSupabaseConfigured) {
    const [{ data: productRows }, { data: categoryRows }] = await Promise.all([
      supabaseAdmin.from("products").select("name, slug, short_description").eq("status", "active").limit(50),
      supabaseAdmin.from("categories").select("name, slug, description").eq("is_visible", true).limit(50)
    ]);

    products = ((productRows ?? []) as Array<{ name: string; slug: string; short_description: string | null }>).filter(
      (product) =>
        [product.name, product.short_description].filter(Boolean).some((value) => String(value).toLowerCase().includes(term))
    );

    categories = (
      (categoryRows ?? []) as Array<{ name: string; slug: string; description: string | null }>
    ).filter((category) =>
      [category.name, category.description].filter(Boolean).some((value) => String(value).toLowerCase().includes(term))
    );
  }

  return {
    articles: articleMatches.slice(0, 8).map((article) => ({
      title: article.title,
      slug: article.slug,
      kind: isGuideArticle(article) ? "guide" : "help"
    })),
    faqs: faqMatches.slice(0, 8),
    seoPages: [
      ...products.slice(0, 5).map((product) => ({
        title: product.name as string,
        url: `/products/${product.slug}`,
        type: "product",
        description: (product.short_description as string | null) || "Product page"
      })),
      ...categories.slice(0, 5).map((category) => ({
        title: category.name as string,
        url: `/categories/${category.slug}`,
        type: "category",
        description: (category.description as string | null) || "Category page"
      }))
    ]
  };
}

export async function incrementHelpArticleViewCount(id: string) {
  const { error } = await supabaseAdmin.rpc("increment_help_article_view_count", {
    article_id: id
  });

  if (!error) {
    return;
  }

  const { data: article } = await supabaseAdmin.from("help_articles").select("view_count").eq("id", id).maybeSingle();
  const current = Number(article?.view_count ?? 0);

  await supabaseAdmin
    .from("help_articles")
    .update({
      view_count: current + 1,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);
}

export async function submitHelpFeedback(args: {
  articleId: string;
  isHelpful: boolean;
  customerId?: string | null;
  sessionId?: string | null;
  feedbackText?: string | null;
}) {
  const { data, error } = await supabaseAdmin
    .from("help_article_feedback")
    .insert({
      article_id: args.articleId,
      is_helpful: args.isHelpful,
      user_id: args.customerId ?? null,
      session_id: args.sessionId ?? null,
      feedback_text: args.feedbackText ?? null
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
