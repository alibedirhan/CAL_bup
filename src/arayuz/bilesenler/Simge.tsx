// Uygulamada kullanılan çizgi simgeler. Hepsi currentColor ile boyanır.

const YOLLAR = {
  musteriler:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.9M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  depo: 'M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM7 21v-7h10v7M7 17h10',
  kutu: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  terazi: 'M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z',
  palet: 'M3 15h18M3 19h18M5 15v4M12 15v4M19 15v4M6 11h12V5H6z',
  gecmis: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
  ayar: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
  kilit: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  kart: 'M3 5h18v14H3zM3 9h18M6 15h4',
  gunes:
    'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  ay: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5',
  ekran: 'M3 5h18v12H3zM8 21h8M12 17v4',
  dosya: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6',
  tik: 'M5 12.5 10 17 19 7.5',
  bulut: 'M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z',
} as const;

export type SimgeAdi = keyof typeof YOLLAR;

export function Simge({ ad, boyut = 18 }: { ad: SimgeAdi; boyut?: number }) {
  return (
    <svg
      width={boyut}
      height={boyut}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={YOLLAR[ad]} />
    </svg>
  );
}
