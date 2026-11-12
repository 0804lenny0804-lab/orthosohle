<template>
  <div class="app-shell" :class="{ 'auth-view': authView }">
    <a class="skip-link" href="#main" @click.prevent="focusMain">Zum Inhalt springen</a>
    <header class="app-header" :class="{ 'auth-header': authView }">
      <div class="header-inner">
        <a class="brand" href="#account" aria-label="OrthoSohle – zum Konto" @click.prevent="$emit('navigate', 'account')">
          <span class="brand-symbol" aria-hidden="true"><i class="bi bi-activity"></i></span>
          <span>Ortho<span class="brand-accent">Sohle</span></span>
        </a>
        <nav v-if="!authView" class="primary-navigation" aria-label="Hauptnavigation">
          <a v-for="item in navigation" :key="item.id" :href="`#${item.id}`"
            class="navigation-item" :class="{ 'is-active': activeNav === item.id }"
            :aria-current="activeNav === item.id ? 'page' : undefined"
            @click.prevent="$emit('navigate', item.id)">
            <i :class="`bi ${item.icon}`" aria-hidden="true"></i>
            <span>{{ item.label }}</span>
          </a>
        </nav>
      </div>
    </header>

    <main id="main" class="app-main" :class="{ 'account-page': activeNav === 'account' }" tabindex="-1">
      <div v-if="!authView" class="page-introduction">
        <div>
          <p class="page-eyebrow">{{ currentPage.eyebrow }}</p>
          <h1>{{ currentPage.title }}</h1>
          <p class="page-description">{{ currentPage.description }}</p>
        </div>
      </div>
      <div class="page-content"><slot /></div>
      <footer v-if="!authView" class="app-footer">OrthoSohle</footer>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { accountSession } from '../../features/account/session.js';

const props = defineProps({ activeNav: { type: String, required: true } });
defineEmits(['navigate']);

const navigation = [
  { id: 'live', label: 'Übersicht', icon: 'bi-house-door', eyebrow: 'Deine Übersicht', title: 'Im Moment.', description: 'Belastung und Messwerte während einer aktiven Sitzung.' },
  { id: 'history', label: 'Verlauf', icon: 'bi-bar-chart', eyebrow: 'Rückblick', title: 'Dein Verlauf.', description: 'Messungen und Auswertungen.' },
  { id: 'connect', label: 'Geräte', icon: 'bi-bluetooth', eyebrow: 'Verbindung', title: 'Deine Geräte.', description: 'Verbinde eine unterstützte Sohle mit diesem Gerät.' },
  { id: 'config', label: 'Einstellungen', icon: 'bi-sliders', eyebrow: 'Einstellungen', title: 'Einstellungen.', description: 'Lege deine persönlichen Werte fest.' },
  { id: 'account', label: 'Konto', icon: 'bi-person-circle', eyebrow: 'Dein persönlicher Zugang', title: 'Dein Konto.', description: 'Verwalte deine Kontodaten.' },
];
function focusMain() {
  document.getElementById('main')?.focus();
}

const currentPage = computed(() => navigation.find(item => item.id === props.activeNav) || navigation[4]);
const authView = computed(() => props.activeNav === 'account' && accountSession.state.status !== 'authenticated');
</script>

<style>
:root {
  --sohle: #E6007E;
  --app-text: #202127;
  --app-muted: #62656f;
  --app-background: #f6f6f9;
  --app-line: #e7e7ed;
}
html.display-text-large { font-size: 112.5%; }
html.display-contrast-high {
  --app-text: #111;
  --app-muted: #333;
  --app-background: #fff;
  --app-line: #777;
}
html.display-contrast-high .app-shell .card { border-color: #666; }
html.display-contrast-high .app-shell .navigation-item { color: #333; }
html.display-contrast-high .app-shell .navigation-item.is-active { color: #79003f; background: #f8d7e8; }
body { margin: 0; background: var(--app-background); color: var(--app-text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
.app-shell { min-height: 100dvh; }
.app-header { position: fixed; inset: 0 auto 0 0; z-index: 1030; width: 232px; background: rgba(255,255,255,.96); backdrop-filter: blur(18px); border-right: 1px solid var(--app-line); }
.header-inner { min-height: 100%; padding: 28px 18px; display: flex; flex-direction: column; align-items: stretch; gap: 36px; }
.brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: var(--app-text); font-weight: 750; font-size: 1.22rem; letter-spacing: -.055em; flex-shrink: 0; }
.brand-symbol { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 12px; color: white; background: var(--sohle); font-size: 1.2rem; }
.brand-accent { color: var(--sohle); }
.primary-navigation { display: flex; flex-direction: column; gap: 7px; }
.navigation-item { display: flex; flex-direction: row; align-items: center; gap: 13px; padding: 12px 14px; border-radius: 13px; color: var(--app-muted); text-decoration: none; font-size: .88rem; font-weight: 600; }
.navigation-item i { width: 20px; font-size: 1.2rem; line-height: 1.3; text-align: center; }
.navigation-item:hover { background: #f4f1f5; color: var(--app-text); }
.navigation-item.is-active { color: var(--sohle); background: #faedf4; }
.app-main { max-width: 1120px; padding: 40px 32px 24px; margin: 0 auto 0 232px; }
.page-introduction { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 22px; }
.page-eyebrow { color: var(--sohle); font-size: .72rem; font-weight: 700; letter-spacing: .075em; text-transform: uppercase; margin: 0 0 12px; }
.page-introduction h1 { font-size: clamp(1.75rem, 3vw, 2.25rem); line-height: 1.12; letter-spacing: -.055em; font-weight: 730; margin: 0 0 9px; }
.page-description { color: var(--app-muted); font-size: 1rem; line-height: 1.6; margin: 0; max-width: 35rem; }
.account-page { max-width: 680px; }
.app-shell.auth-view { display: grid; min-height: 100dvh; place-items: center; }
.auth-header { position: fixed; inset: 0 0 auto; width: 100%; height: 76px; border-right: 0; border-bottom: 1px solid var(--app-line); }
.auth-header .header-inner { min-height: 76px; padding: 0 28px; flex-direction: row; align-items: center; }
.auth-header ~ .app-main { margin: 76px auto 0; width: min(100%, 680px); padding-top: 36px; }
.account-page .page-introduction { text-align: center; justify-content: center; margin-top: 16px; margin-bottom: 30px; }
.account-page .page-description { margin: auto; }
.app-shell .card { border: 1px solid var(--app-line); border-radius: 22px; background: #fff; box-shadow: 0 8px 28px rgba(27,30,44,.035); }
.app-shell .card-body { padding: 26px; }
.app-shell .card .card { box-shadow: none; }
.app-shell .form-label { font-size: .84rem; font-weight: 600; margin-bottom: 8px; }
.app-shell .form-control { min-height: 48px; border-radius: 12px; border-color: #d7d9e1; padding: 11px 13px; color: var(--app-text); background: #fdfdfe; }
.app-shell .form-control:focus { border-color: var(--sohle); box-shadow: 0 0 0 3px #e6007e1c; }
.app-shell .btn { min-height: 44px; border-radius: 12px; font-weight: 600; font-size: .86rem; padding: 10px 16px; }
.app-shell .btn-primary, .app-shell .btn-sohle { color: white !important; background: var(--sohle) !important; border-color: var(--sohle) !important; }
.app-shell .btn-primary:hover, .app-shell .btn-sohle:hover { background: #970a53 !important; border-color: #970a53 !important; }
.app-shell .btn-link { color: var(--sohle); text-decoration: none; }
.app-shell .btn-link:hover { text-decoration: underline; }
.app-shell .alert { font-size: .81rem; line-height: 1.55; border-radius: 14px; }
.app-shell .alert-warning { background: #fbf7ef; color: #665020; border-color: #ece0c6; }
.app-shell .alert-info { background: #f1f5fa; color: #354f6e; border-color: #dce5ef; }
.app-shell .text-sohle, .app-shell .text-ortho { color: var(--sohle) !important; }
.app-footer { margin-top: 36px; color: #727580; font-size: .72rem; text-align: center; }
.app-footer span { padding: 0 5px; }
.app-shell :focus-visible { outline: 3px solid #8b3db8; outline-offset: 4px; }
.skip-link { position: fixed; top: -100px; left: 16px; padding: 12px 18px; z-index: 1100; color: white; background: var(--sohle); border-radius: 0 0 12px 12px; }
.skip-link:focus { top: 0; }
@media (max-width: 640px) {
  .app-header { position: static; width: auto; height: auto; border-right: 0; border-bottom: 1px solid var(--app-line); backdrop-filter: none; }
  .header-inner { min-height: 64px; padding: env(safe-area-inset-top, 0px) 20px 0; flex-direction: row; align-items: center; }
  .brand { font-size: 1.15rem; }
  .brand-symbol { width: 32px; height: 32px; border-radius: 10px; }
  .primary-navigation { position: fixed; z-index: 1030; bottom: 0; left: 0; right: 0; flex-direction: row; justify-content: space-around; gap: 0; padding: 8px 8px calc(8px + env(safe-area-inset-bottom, 0px)); background: rgba(255,255,255,.97); border-top: 1px solid var(--app-line); box-shadow: 0 -3px 18px #20212705; backdrop-filter: blur(18px); }
  .navigation-item { flex: 1; min-width: 0; flex-direction: column; padding: 7px 2px; font-size: .64rem; border-radius: 12px; gap: 4px; }
  .navigation-item i { font-size: 1.25rem; }
  .app-main { margin: 0; padding: 28px 16px calc(108px + env(safe-area-inset-bottom, 0px)); }
  .page-introduction { gap: 12px; }
  .page-introduction h1 { font-size: 1.95rem; }
  .page-description { font-size: .9rem; }
  .page-eyebrow { font-size: .65rem; }
  .account-page .page-introduction { margin-top: 4px; margin-bottom: 22px; }
  .app-shell .card-body { padding: 22px 18px; }
  .app-shell .card { border-radius: 20px; }
  .app-shell.auth-view { display: block; }
  .auth-header { position: static; width: auto; height: auto; }
  .auth-header .header-inner { min-height: 64px; padding: env(safe-area-inset-top, 0px) 20px 0; }
  .auth-header ~ .app-main { margin: 0; padding: 24px 16px 32px; width: auto; }
  .app-shell .toast-container { bottom: calc(80px + env(safe-area-inset-bottom, 0px)) !important; }
}
@media (prefers-reduced-motion: reduce) {
  .app-shell *, .app-shell *::before, .app-shell *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
</style>
