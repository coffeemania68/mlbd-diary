// 셸(화면 틀) 인스턴스를 들고 있는 작은 모듈.
// main.js가 mountShell() 결과를 setShell()로 넣고, 화면 모듈은 여기서 위치 문구를 고친다.
// main.js를 화면 모듈이 직접 import하면 순환 import가 생기므로 이 파일을 거친다.
//
// 화면에서 쓰는 법 (예: 캐릭터 상세에서 이름을 위치 문구에 붙이기):
//   import { setLocationExtras } from '../ui.js';
//   setLocationExtras(route, { characterName: character.name });
// route는 render(el, route)로 받은 객체를 그대로 넘긴다. 그래야 다른 화면으로 넘어간 뒤
// 늦게 도착한 호출이 새 화면의 위치 문구를 덮어쓰지 않는다.
import { locationLabel } from './shell.js';

let shell = null;
let currentRoute = null;
let extrasRoute = null;
let extras = {};

/** main.js가 한 번 부른다. */
export function setShell(instance) {
  shell = instance;
}

/** mountShell() 결과. 아직 없으면 null */
export function getShell() {
  return shell;
}

/** 라우터의 onRouteChange에서 부른다. 이 경로에 맞는 extras가 있으면 같이 쓴다. */
export function showRouteLocation(route) {
  currentRoute = route;
  if (extrasRoute !== route) {
    extrasRoute = null;
    extras = {};
  }
  shell?.setLocation(locationLabel(route, extras));
}

/**
 * 위치 문구에 덧붙일 값(예: characterName)을 정한다.
 * 화면이 render 도중에 불러도, 그 뒤에 불러도 같은 결과가 나온다.
 * @param {object} route  render(el, route)로 받은 경로 객체
 * @param {{ characterName?: string }} next
 */
export function setLocationExtras(route, next = {}) {
  extrasRoute = route;
  extras = { ...next };
  if (currentRoute === route) shell?.setLocation(locationLabel(route, extras));
}
