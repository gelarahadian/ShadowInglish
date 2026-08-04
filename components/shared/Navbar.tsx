import Link from "next/link";
import { Button } from "../ui/button";
import { User } from "@supabase/supabase-js";
import { signOut } from "@/features/auth/actions";

export default function Navbar({ user }: { user: User | null }) {
  return (
    <header className="fixed top-0 right-0 left-0 z-50 bg-white/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex-shrink-0">
            <Link
              href="/"
              className="text-2xl font-bold text-gray-900"
            >
              ShadowInglish
            </Link>
          </div>
          <nav className="hidden md:flex md:space-x-8">
            <Link
              href="/lessons"
              className="text-gray-500 hover:text-gray-900"
            >
              Lessons
            </Link>
            <Link
              href="/lessons/create"
              className="text-gray-500 hover:text-gray-900"
            >
              Create Lesson
            </Link>
          </nav>
          <div>
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm">Hi, {user.email?.split("@")[0]}</span>
                <form action={signOut}>
                  <Button variant="outline" size="sm">
                    Sign Out
                  </Button>
                </form>
              </div>
            ) : (
              <Link href="/login">
                <Button>Login</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
