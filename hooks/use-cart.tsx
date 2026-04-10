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

function persistCart(items: CartItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setItems(JSON.parse(saved) as CartItem[]);
    }
  }, []);

  useEffect(() => {
    persistCart(items);
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

          let nextItems: CartItem[];
          if (existing) {
            nextItems = current.map((entry) =>
              entry.productId === item.productId && entry.variantId === item.variantId
                ? { ...entry, quantity: entry.quantity + item.quantity }
                : entry
            );
          } else {
            nextItems = [...current, item];
          }

          persistCart(nextItems);
          return nextItems;
        });
      },
      updateQuantity(productId, quantity, variantId) {
        if (quantity <= 0) {
          setItems((current) => {
            const nextItems = current.filter((item) => !(item.productId === productId && item.variantId === variantId));
            persistCart(nextItems);
            return nextItems;
          });
          return;
        }

        setItems((current) => {
          const nextItems = current.map((item) =>
            item.productId === productId && item.variantId === variantId ? { ...item, quantity } : item
          );
          persistCart(nextItems);
          return nextItems;
        });
      },
      removeItem(productId, variantId) {
        setItems((current) => {
          const nextItems = current.filter((item) => !(item.productId === productId && item.variantId === variantId));
          persistCart(nextItems);
          return nextItems;
        });
      },
      clear() {
        persistCart([]);
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
