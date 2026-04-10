"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  variantId?: string | null;
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string | null) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "creatorstack-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setItems(JSON.parse(saved) as CartItem[]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      addItem(item) {
        setItems((current) => {
          const existing = current.find(
            (entry) => entry.productId === item.productId && entry.variantId === item.variantId
          );

          if (existing) {
            return current.map((entry) =>
              entry.productId === item.productId && entry.variantId === item.variantId
                ? { ...entry, quantity: entry.quantity + item.quantity }
                : entry
            );
          }

          return [...current, item];
        });
      },
      updateQuantity(productId, quantity, variantId) {
        if (quantity <= 0) {
          setItems((current) =>
            current.filter((item) => !(item.productId === productId && item.variantId === variantId))
          );
          return;
        }

        setItems((current) =>
          current.map((item) =>
            item.productId === productId && item.variantId === variantId ? { ...item, quantity } : item
          )
        );
      },
      removeItem(productId, variantId) {
        setItems((current) =>
          current.filter((item) => !(item.productId === productId && item.variantId === variantId))
        );
      },
      clear() {
        setItems([]);
      }
    }),
    [items]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return context;
}
