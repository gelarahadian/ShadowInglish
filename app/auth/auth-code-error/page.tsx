export default function AuthCodeError() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1>Authentication Error</h1>
      <p>Sorry, we couldn't sign you in. Please try again.</p>
      <a href="/login" className="underline mt-4">
        Back to Login
      </a>
    </div>
  );
}
