import { Component, type ReactNode } from 'react';
export class HataSiniri extends Component<{ children: ReactNode }, { hata: boolean }> {
  override state = { hata: false };
  static getDerivedStateFromError() {
    return { hata: true };
  }
  // Ham hata/React yığını cari, dosya veya kart içerebilir: günlüğe yazılmaz.
  override componentDidCatch(): void {}
  override render() {
    if (!this.state.hata) return this.props.children;
    return (
      <main className="sayfa">
        <section className="kart" role="alert">
          <h1>Ekran açılamadı</h1>
          <p>
            Beklenmeyen bir sorun oluştu. Tarayıcıdaki kayıtlarınızı silmeden uygulamayı yeniden
            açabilirsiniz.
          </p>
          <button className="dugme" onClick={() => location.reload()}>
            Uygulamayı yeniden aç
          </button>
        </section>
      </main>
    );
  }
}
