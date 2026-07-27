import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-black">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="space-y-8 xl:col-span-1">
            <Link
              href="/"
              className="text-2xl font-bold text-gray-900 dark:text-white"
            >
              ShadowInglish
            </Link>
            <p className="text-base text-gray-500 dark:text-gray-400">
              Upgrade your English speaking skills with shadowing.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold tracking-wider text-gray-400 uppercase">
                  Solutions
                </h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <Link
                      href="#"
                      className="text-base text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    >
                      Pricing
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-semibold tracking-wider text-gray-400 uppercase">
                  Support
                </h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <Link
                      href="#"
                      className="text-base text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    >
                      Contact
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold tracking-wider text-gray-400 uppercase">
                  Company
                </h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <Link
                      href="#"
                      className="text-base text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    >
                      About
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-gray-200 pt-8 dark:border-gray-800">
          <p className="text-base text-gray-400 xl:text-center">
            &copy; {new Date().getFullYear()} ShadowInglish, Inc. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
