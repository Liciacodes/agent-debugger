export interface CartItem {
  name: string;
  price: number;
  quantity: number;
}

export function calculateTotal(items: CartItem[], discountPercent = 0): number {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return subtotal - discountPercent;
}
