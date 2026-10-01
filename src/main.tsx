import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/onest';
import '@fontsource-variable/geologica';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './arayuz/stiller/tema.css';
import './arayuz/stiller/temel.css';
import './arayuz/stiller/kabuk.css';
import './arayuz/stiller/bilesenler.css';
import './arayuz/stiller/formlar.css';
import './arayuz/stiller/depoKontrol.css';
import { Uygulama } from './arayuz/Uygulama';
import { kayitliTercih, temaUygula } from './arayuz/tema';

// Tema ilk çizimden önce uygulanır, yoksa koyu temada bir an beyaz görünür.
temaUygula(kayitliTercih());

const kok = document.getElementById('kok');
if (!kok) throw new Error('#kok bulunamadı');

createRoot(kok).render(
  <StrictMode>
    <Uygulama />
  </StrictMode>,
);
