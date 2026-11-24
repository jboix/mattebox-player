import{a as e,n as t,r as n,t as r}from"./theme-TfFI5Nci.js";import"./src-BKs422e-.js";import{n as i}from"./srgssr-N2yoWSn4.js";for(let e of document.querySelectorAll(`img.logo`))e.src=t;for(let e of document.querySelectorAll(`link[rel="icon"]`))e.href=t;function a(e){let t=document.getElementById(e);if(t===null)throw Error(`no #${e}`);return t}n.define({connectors:[i]});var o=[{urn:`urn:rts:video:11073114`,label:`Le petit Burki animé, le film en 360°`,note:`An animated film, 4096 by 2048 at the top of the ladder.`},{urn:`urn:rts:video:8414077`,label:`Le Gothard en 360°`,note:`The Gotthard, filmed from the road and the tunnel.`},{urn:`urn:rts:video:9191199`,label:`Mobilité en 360°`,note:`Getting around, in 360°.`},{urn:`urn:rts:video:7800215`,label:`Le goût du risque 360`,note:`A report filmed in 360°.`},{urn:`urn:rts:video:10017904`,label:`Test 360: Bord du lac`,note:`An RTS test clip: a lake shore.`},{urn:`urn:rts:video:10017956`,label:`Test 360: Vignoble`,note:`An RTS test clip: a vineyard.`}],s=a(`player`),c=a(`view`),l=a(`example`),u=a(`projection`),d=a(`note`),f=a(`code`),p=a(`status`),m=a(`readout`);for(let[e,t]of o.entries())l.append(new Option(t.label,String(e)));var h=`mattebox.demo.360.example`;function g(){try{let e=Number(localStorage.getItem(h));return Number.isInteger(e)&&o[e]!==void 0?e:0}catch(e){return 0}}function _(e){let t=u.value===``?``:` projection="${u.value}"`;return`<mattebox-player controls="custom" muted
  type="srgssr/urn" src="${e.urn}">
  <mbx-360${t}></mbx-360>
  <mbx-control-bar>
    <mbx-play-button></mbx-play-button>
    <mbx-seek-bar></mbx-seek-bar>
    <mbx-volume></mbx-volume>
    <mbx-fullscreen-button></mbx-fullscreen-button>
  </mbx-control-bar>
</mattebox-player>

<script type="module">
  import { MatteboxPlayerElement } from '@mattebox/player';
  import '@mattebox/player-360';

  // The connector sets the source's projection, here from the IL's
  // presentation VIDEO_360.
  MatteboxPlayerElement.define({ connectors: [srgssrConnector] });
<\/script>`}function v(e){var t;let n=(t=o[e])==null?o[0]:t;if(n!==void 0){try{localStorage.setItem(h,String(e))}catch(e){}d.textContent=`${n.note} ${n.urn}`,f.textContent=_(n),s.setAttribute(`src`,n.urn)}}l.value=String(g()),l.addEventListener(`change`,()=>v(Number(l.value))),u.addEventListener(`change`,()=>{var e;u.value===``?c.removeAttribute(`projection`):c.setAttribute(`projection`,u.value),f.textContent=_((e=o[Number(l.value)])==null?o[0]:e)}),v(Number(l.value)),a(`ahead`).addEventListener(`click`,()=>{c.yaw=0,c.pitch=0});function y(e,t){let n=document.createElement(`dt`);n.textContent=e;let r=document.createElement(`dd`);return r.textContent=t,[n,r]}function b(){var t;let n=c.getAttribute(`unavailable`),r=c.hasAttribute(`active`)?`shows`:n===null?`flat source`:`off: ${n}`;e(m,...y(`View`,r),...y(`Projection`,(t=c.projection)==null?`none`:t),...y(`Yaw`,`${Math.round(c.yaw)}°`),...y(`Pitch`,`${Math.round(c.pitch)}°`),...y(`Field of view`,`${Math.round(c.fov)}°`)),requestAnimationFrame(b)}requestAnimationFrame(b),s.addEventListener(`error`,e=>{var t;p.textContent=`error: ${(t=e.detail.code)==null?``:t}`}),s.addEventListener(`sourcechange`,()=>{p.textContent=``}),a(`copy-code`).addEventListener(`click`,()=>{var e,t;(e=navigator.clipboard)==null||e.writeText((t=f.textContent)==null?``:t)}),r(a(`theme-toggle`));