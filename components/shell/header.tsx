"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/use-cart";

const navItems: Array<{ href: Route; label: string }> = [
  { href: "/", label: "Home" },
  { href: "/catalog", label: "Catalog" },
  { href: "/downloads", label: "Downloads" },
  { href: "/support", label: "Support" },
  { href: "/wallet", label: "Wallet" }
];

export function Header({ storeName, logoUrl }: { storeName: string; logoUrl: string }) {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const { customer, openAuthDialog } = useAuth();

  return (
    <header className="shell-header">
      <div className="page-shell shell-header__inner">
        <Link className="brand-mark" href="/">
          <Image alt={storeName} className="brand-mark__logo" height={52} src={logoUrl} width={52} />
          <div>
            <p className="eyebrow">Premium digital products</p>
            <strong>{storeName}</strong>
          </div>
        </Link>

        <nav className="shell-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={cn("shell-nav__link", pathname === item.href && "shell-nav__link--active")}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
          {customer ? (
            <Link
              className={cn(
                "shell-nav__link",
                (pathname === "/account" || pathname === "/auth") && "shell-nav__link--active"
              )}
              href="/account"
            >
              Account
            </Link>
          ) : (
            <button
              className={cn(
                "shell-nav__link shell-nav__button",
                (pathname === "/account" || pathname === "/auth") && "shell-nav__link--active"
              )}
              onClick={() => openAuthDialog({ redirectTo: "/account" })}
              type="button"
            >
              Account
            </button>
          )}
        </nav>

        <Link className="cart-pill" href="/checkout">
          Cart
          <span>{totalItems}</span>
        </Link>
      </div>
    </header>
  );
}
