export default function AuthCodeError() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1>Galat Autentikasi</h1>
      <p>Maaf, kami tidak dapat memproses masuk Anda. Silakan coba lagi.</p>
      <a href="/login" className="underline mt-4">
        Kembali ke Masuk
      </a>
    </div>
  );
}
