// Link click-to-chat a WhatsApp con mensaje precargado.
const NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(
  /[^0-9]/g,
  ""
);

export function isWhatsAppConfigured(): boolean {
  return NUMBER.length >= 10;
}

export function waLink(mensaje: string): string {
  if (!isWhatsAppConfigured()) return "#";
  return `https://wa.me/${NUMBER}?text=${encodeURIComponent(mensaje)}`;
}

export function waNumber(): string {
  return NUMBER;
}
