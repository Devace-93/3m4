import { component$ } from "@builder.io/qwik";
import { QwikCityProvider, RouterOutlet } from "@builder.io/qwik-city";
import { RouterHead } from "./components/router-head";
import "./global.css";

export default component$(() => {
  /**
   * The root of the Qwik City app. <head> + <body> live here; per-route chrome
   * (marketing nav / dashboard nav) is provided by the layouts under src/routes.
   */
  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="manifest" href="/manifest.json" />
        <RouterHead />
      </head>
      <body lang="en" class="min-h-screen bg-white">
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
