import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export interface CartItem {
  listing_id: number;
  item_name: string;
  price: number;
  image_url: string;
  store_id: number;
  store_name: string;
  quantity: number;
  max_quantity: number;
  store_lat?: string | null;
  store_lng?: string | null;
}

interface CartContextData {
  items: CartItem[];
  addToCart: (item: CartItem, override?: boolean) => Promise<boolean>;
  removeFromCart: (listing_id: number) => Promise<void>;
  updateQuantity: (listing_id: number, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  storeId: number | null;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextData>({} as CartContextData);

export const useCart = () => useContext(CartContext);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const loadCart = async () => {
      try {
        const saved = await AsyncStorage.getItem('saveabite_cart');
        if (saved) setItems(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load cart", e);
      }
    };
    loadCart();
  }, []);

  const saveCart = async (newItems: CartItem[]) => {
    setItems(newItems);
    await AsyncStorage.setItem('saveabite_cart', JSON.stringify(newItems));
  };

  const addToCart = async (item: CartItem, override = false): Promise<boolean> => {
    return new Promise((resolve) => {
      if (items.length > 0) {
        const currentStoreId = items[0].store_id;
        if (currentStoreId !== item.store_id) {
          if (override) {
            saveCart([{ ...item, quantity: 1 }]);
            resolve(true);
            return;
          }
          
          Alert.alert(
            "Different Restaurant",
            `You already have items from ${items[0].store_name} in your cart. You can only order from one restaurant at a time. Do you want to clear your cart and add this item instead?`,
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Clear & Add", style: "destructive", onPress: () => {
                saveCart([{ ...item, quantity: 1 }]);
                resolve(true);
              }}
            ]
          );
          return;
        }
      }

      const existingItem = items.find(i => i.listing_id === item.listing_id);
      if (existingItem) {
        if (existingItem.quantity >= item.max_quantity) {
          Alert.alert("Limit Reached", "You cannot add more of this item than what's in stock.");
          resolve(false);
          return;
        }
        const updated = items.map(i => 
          i.listing_id === item.listing_id ? { ...i, quantity: i.quantity + 1 } : i
        );
        saveCart(updated);
      } else {
        saveCart([...items, { ...item, quantity: 1 }]);
      }
      resolve(true);
    });
  };

  const removeFromCart = async (listing_id: number) => {
    saveCart(items.filter(i => i.listing_id !== listing_id));
  };

  const updateQuantity = async (listing_id: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(listing_id);
      return;
    }
    const updated = items.map(i => {
      if (i.listing_id === listing_id) {
        return { ...i, quantity: Math.min(quantity, i.max_quantity) };
      }
      return i;
    });
    saveCart(updated);
  };

  const clearCart = async () => {
    saveCart([]);
  };

  const storeId = items.length > 0 ? items[0].store_id : null;
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, addToCart, removeFromCart, updateQuantity, clearCart, storeId, totalItems, totalPrice
    }}>
      {children}
    </CartContext.Provider>
  );
};
