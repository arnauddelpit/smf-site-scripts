/**
 * Feuille de style du jeu « Qui est-ce ? » (injectée une fois par team-game.js).
 * Ce que l'API Webflow ne sait pas exprimer : états (.is-ok, .is-wrong…), pseudo-éléments, :has(), keyframes, éléments créés par le JS
 * (cartes de l'éventail, confettis). Le reste (carte indice, scène, fiche) est stylé dans Webflow avec les variables du thème.
 * Les couleurs viennent des variables Webflow (--_palette---…) avec un repli en dur ; les sélecteurs privilégient les attributs data-smf-*.
 */
export const GAME_CSS = `
/* ── Carte indice collante : sous la nav, ou tout en haut quand la nav est masquée ── */
:root{--smf-sticky-top:calc(var(--smf-nav-h,6rem) + 1rem)}
:root:has([data-smf-nav].is-hidden){--smf-sticky-top:1rem}

[data-smf-team-hint] [data-smf-mark]{background-image:linear-gradient(to bottom,transparent 60%,var(--_palette---color--accent--lime,#dbfa0a) 60%,var(--_palette---color--accent--lime,#dbfa0a) 92%,transparent 92%);background-repeat:no-repeat;background-size:var(--mark,100%) 100%;-webkit-box-decoration-break:clone;box-decoration-break:clone;padding:0 .14em;margin:0 -.14em}
[data-smf-pip].is-done,[data-smf-dot].is-done{background-color:var(--_palette---color--brand--blue,#3953a0);border-color:var(--_palette---color--brand--blue,#3953a0)}
[data-smf-pip].is-current{background-color:var(--_palette---color--accent--yellow,#fcc028);border-color:var(--_palette---color--brand--blue,#3953a0);transform:scale(1.3)}
[data-smf-team-clue].is-ok{border-color:var(--_palette---color--accent--lime,#dbfa0a);box-shadow:0 10px 32px rgba(219,250,10,.65)}
[data-smf-team-clue].is-ko{border-color:var(--_palette---color--brand--pink,#f65469);box-shadow:0 10px 32px rgba(246,84,105,.45)}
[data-smf-team-clue].is-done{background-color:var(--_palette---color--accent--lime,#dbfa0a);border-style:solid;border-color:var(--_palette---color--neutral--black,#000)}
[data-smf-team-bar].is-stuck [data-smf-team-clue]{box-shadow:0 16px 36px rgba(21,47,127,.22)}
[data-smf-team-feedback].is-ok{background-color:var(--_palette---color--accent--lime,#dbfa0a);color:var(--_palette---color--neutral--black,#000)}
[data-smf-team-feedback].is-ko{background-color:var(--_palette---color--brand--pink,#f65469);color:var(--_palette---color--neutral--white,#fff)}
[data-smf-team-feedback].is-tip{background-color:var(--_palette---color--brand--blue,#3953a0);color:var(--_palette---color--neutral--white,#fff)}
[data-smf-team-help].is-on{display:inline-flex;align-items:center}
@media (max-width:767px){
  /* collée sur mobile : seule la partie indice reste (boutons masqués, sauf coup de pouce / fin de partie) */
  [data-smf-team-bar].is-stuck .team_clue-bottom:not(:has(.is-on)){display:none}
}

/* ── Cartes du plateau ── */
[data-smf-team="game"] .member-card{-webkit-tap-highlight-color:transparent;touch-action:manipulation;outline:none}
[data-smf-team="game"] .member-card_inner{transition:transform .85s cubic-bezier(.3,1.55,.45,1)}
[data-smf-team="game"] .member-card_front{overflow:hidden;transition:box-shadow .25s ease}
[data-smf-team="game"] .member-card_front::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at var(--gx,50%) var(--gy,0%),rgba(255,255,255,.78),rgba(255,255,255,0) 55%);opacity:0;transition:opacity .25s ease}
@media (hover:hover){
  [data-smf-team="game"] .member-card:not(.is-flipped):hover .member-card_front{box-shadow:0 18px 30px rgba(185,156,86,.5)}
  [data-smf-team="game"] .member-card:not(.is-flipped):hover .member-card_front::after{opacity:1}
}
[data-smf-team="game"] .member-card:active:not(.is-flipped) .member-card_front{transform:scale(.97)}
[data-smf-team="game"] .member-card:focus-visible .member-card_front{outline:3px solid var(--_theme---focus--ring,#3953a0);outline-offset:3px}
[data-smf-team="game"] .member-card.is-flipped{cursor:default}
[data-smf-team="game"] .member-card.is-wrong .member-card_front{box-shadow:0 0 0 3px var(--_palette---color--brand--pink,#f65469),0 14px 28px rgba(246,84,105,.5)}
[data-smf-team="game"] .member-card.is-wrong .member-card_front::before{content:"\\00d7";position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;background:rgba(246,84,105,.62);color:#fff;font:800 6rem/1 var(--_typography---font--display,sans-serif);animation:smf-pop .45s cubic-bezier(.3,1.6,.5,1) both}
[data-smf-team="game"] .member-card.is-hint .member-card_front{animation:smf-hint 1s ease-in-out infinite}
[data-smf-team="game"] .member-card.is-winner .member-card_front{box-shadow:0 0 0 4px var(--_palette---color--accent--lime,#dbfa0a),0 16px 30px rgba(0,0,0,.22);animation:smf-winner 2.2s ease-in-out infinite}
@keyframes smf-pop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes smf-hint{0%,100%{box-shadow:0 0 0 3px var(--_palette---color--accent--lime,#dbfa0a),0 0 0 0 rgba(219,250,10,.75)}50%{box-shadow:0 0 0 3px var(--_palette---color--accent--lime,#dbfa0a),0 0 30px 12px rgba(219,250,10,.8)}}
@keyframes smf-winner{0%,100%{box-shadow:0 0 0 4px var(--_palette---color--accent--lime,#dbfa0a),0 16px 30px rgba(0,0,0,.22)}50%{box-shadow:0 0 0 7px var(--_palette---color--accent--lime,#dbfa0a),0 22px 38px rgba(0,0,0,.28)}}

/* ── Scène finale (dialog natif Webflow) : dégradé qui apparaît par-dessus la page, copies des cartes en éventail ── */
html:has(dialog[data-smf-team-stage][open]){overflow:hidden;scrollbar-gutter:stable}
dialog[data-smf-team-stage]{background:transparent;border:0;outline:none}
dialog[data-smf-team-stage]::backdrop{background:transparent}
dialog[data-smf-team-stage]::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(120% 90% at 50% 38%,var(--_palette---color--brand--blue,#3953a0) 0%,var(--_palette---color--brand--navy,#152f7f) 68%,#0b1a4a 100%);opacity:var(--stage-fade,1)}
dialog[data-smf-team-stage]>*{position:relative;z-index:1}
dialog[data-smf-team-stage] [data-smf-stage-head]{position:relative;z-index:2}
dialog[data-smf-team-stage] [data-smf-stage-deck]{z-index:1}
dialog[data-smf-team-stage] [data-smf-stage-actions]{position:relative;z-index:3}
[data-smf-stage-sheet]{z-index:120}
dialog[data-smf-team-stage]:not(.has-hand),dialog[data-smf-team-stage]:not(.has-hand) *{cursor:auto!important}
dialog[data-smf-team-stage]:not(.has-hand) a,dialog[data-smf-team-stage]:not(.has-hand) [role="button"]{cursor:pointer!important}
dialog[data-smf-team-stage].has-hand,dialog[data-smf-team-stage].has-hand *{cursor:none!important}
dialog[data-smf-team-stage].is-detail [data-smf-stage-sub],dialog[data-smf-team-stage].is-detail [data-smf-stage-score]{display:none}
@media (max-width:767px){dialog[data-smf-team-stage].is-detail [data-smf-stage-head]{display:none}}
[data-smf-stage-sheet].is-open{display:flex;flex-direction:column;align-items:flex-start;gap:.75rem}
[data-smf-sheet-link].is-on{display:inline-block}

.team_deck-card{--glare:0;position:absolute;left:50%;top:50%;width:var(--cw,300px);margin-left:calc(var(--cw,300px)/-2);margin-top:calc(var(--cw,300px)*-.6);outline:none;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;will-change:transform}
.team_deck-card .member-card{width:100%;max-width:none;pointer-events:none}
.team_deck-card .member-card_front{box-sizing:border-box;background:var(--_palette---color--neutral--white,#fff);border:calc(var(--cw,300px)*.028*var(--edge,1)) solid var(--_palette---color--neutral--white,#fff);border-radius:calc(var(--cw,300px)*.06*var(--edge,1));overflow:hidden;box-shadow:0 calc(var(--cw,300px)*.07) calc(var(--cw,300px)*.14) rgba(0,0,0,calc(.42*var(--edge,1)));animation:none}
.team_deck-card .member-card_front::after{opacity:var(--glare,0);transition:opacity .2s ease}
.team_deck-card .member-card_name{box-sizing:border-box;height:calc(var(--cw,300px)*.2);font-size:calc(var(--cw,300px)*.0933);line-height:1.2;padding:0}
.team_deck-card.is-active .member-card_front{box-shadow:0 0 0 calc(var(--cw,300px)*.014) var(--_palette---color--accent--lime,#dbfa0a),0 calc(var(--cw,300px)*.08) calc(var(--cw,300px)*.16) rgba(0,0,0,.45)}
.team_deck-card:focus-visible .member-card_front{outline:3px solid var(--_palette---color--accent--lime,#dbfa0a);outline-offset:4px}

@media (prefers-reduced-motion:reduce){
  [data-smf-team="game"] .member-card_inner,[data-smf-team="game"] .member-card_front{transition:none}
  [data-smf-team="game"] .member-card.is-hint .member-card_front,[data-smf-team="game"] .member-card.is-winner .member-card_front{animation:none}
  [data-smf-team="game"] .member-card.is-wrong .member-card_front::before{animation:none}
}
`;
