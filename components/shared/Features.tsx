export default function Features() {
  const features = [
    {
      name: "Shadowing Practice",
      description:
        "Listen to native speakers and mimic their pronunciation and intonation.",
    },
    {
      name: "AI Feedback",
      description:
        "Get instant feedback on your pronunciation and fluency from our AI coach.",
    },
    {
      name: "Vocabulary Builder",
      description:
        "Build your vocabulary with words from the videos you watch.",
    },
  ];

  return (
    <section className="bg-white py-12 sm:py-16 lg:py-20 dark:bg-black">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            How ShadowInglish Works
          </h2>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.name}
              className="flex flex-col items-center text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-600 text-white">
                {/* Placeholder for icon */}
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-white">
                {feature.name}
              </h3>
              <p className="mt-2 text-base text-gray-500 dark:text-gray-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
