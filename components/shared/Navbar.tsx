import Link from "next/link";
import Button from "../ui/Button";

export default function Navbar() {
  return (
    <header className="fixed top-0 right-0 left-0 z-50 bg-white/80 backdrop-blur-sm dark:bg-black/80">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex-shrink-0">
            <Link
              href="/"
              className="text-2xl font-bold text-gray-900 dark:text-white"
            >
              ShadowInglish
            </Link>
          </div>
          <nav className="hidden md:flex md:space-x-8">
            <Link
              href="#"
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Official Lesson
            </Link>
            <Link
              href="#"
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Import YouTube
            </Link>
            <Link
              href="#"
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Vocabulary
            </Link>
            <Link
              href="#"
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              AI Coach
            </Link>
          </nav>
          <div>
            <Button>Login</Button>
          </div>
        </div>
      </div>
    </header>
  );
}
