/** Sovelluksen jaettu tila. UI-moduulit lukevat ja kirjoittavat tätä. */

import * as store from "./lib/store.js";

export const app = {
  state: store.load(),
  tab: "home",
  unitIndex: 0,

  save() {
    store.save(this.state);
  },

  /** main.js asettaa nämä — näin UI-moduulien ei tarvitse tuntea toisiaan. */
  render() {},
  goto() {},
};

export const el = (id) => document.getElementById(id);
