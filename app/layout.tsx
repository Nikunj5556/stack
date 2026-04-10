import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";

import "@/app/globals.css";
import { getStoreSettings } from "@/lib/commerce/catalog";
import { env } from "@/lib/env";
import { AppProviders } from "@/components/providers/app-providers";
import { MetaPixel } from "@/components/meta/meta-pixel";
import { Header } from "@/components/shell/header";
import { Footer } from "@/components/shell/footer";
import { buildSiteMetadata } from "@/lib/seo";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body"
});

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

export const metadata: Metadata = buildSiteMetadata(env.appName);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { store, policies } = await getStoreSettings();

  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <MetaPixel />
        <AppProviders>
          <div className="app-frame">
            <Header logoUrl={store.logo_url || env.appLogoUrl} storeName={store.store_name} />
            <main>{children}</main>
            <Footer policies={policies} store={store} />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
