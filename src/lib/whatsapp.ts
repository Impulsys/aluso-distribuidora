// Link click-to-chat a WhatsApp con mensaje precargado.
const NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";

export function waLink(mensaje: string): string {
  return `https://wa.me/${NUMBER}?text=${encodeURIComponent(mensaje)}`;
}

export function waNumber(): string {
  return NUMBER;
}
