/* ---------------------------------------------------------------------
   SETTINGS MODULE (settings.js)
   Baixar/carregar save como arquivo, e preferências globais de áudio/idioma.
   Globais = fora de qualquer save, valem pra todos os personagens/slots (ver
   CONFIG.settingsKey) — evita a estranheza de mudar o volume num personagem
   e outro continuar com o valor antigo. Áudio e idioma são só placeholders
   por enquanto — guardam a preferência, mas não existe sistema de áudio nem
   tradução ainda no jogo.
--------------------------------------------------------------------- */
const SettingsModule = {
  current: { audioEnabled:true, volume:70, language:'pt-BR' },
  LANGUAGES: ['pt-BR', 'en-US'],
  MAX_SAVE_FILE_BYTES: 2 * 1024 * 1024,

  // Roda 1x no boot, antes de qualquer save ser escolhido. Só copia campos
  // conhecidos e do tipo certo (localStorage pode ter sido editado à mão).
  loadGlobalSettings(){
    try{
      const raw = localStorage.getItem(CONFIG.settingsKey);
      if(!raw) return;
      const p = JSON.parse(raw);
      if(!p || typeof p !== 'object') return;
      if(typeof p.audioEnabled === 'boolean') this.current.audioEnabled = p.audioEnabled;
      if(typeof p.volume === 'number' && isFinite(p.volume)) this.current.volume = Math.min(100, Math.max(0, p.volume));
      if(this.LANGUAGES.includes(p.language)) this.current.language = p.language;
    }catch(e){ console.warn('Falha ao carregar configurações', e); }
  },
  saveGlobalSettings(){
    try{ localStorage.setItem(CONFIG.settingsKey, JSON.stringify(this.current)); }catch(e){}
  },
  setAudioEnabled(enabled){ this.current.audioEnabled = enabled; this.saveGlobalSettings(); },
  setVolume(vol){
    if(typeof vol !== 'number' || !isFinite(vol)) return;
    this.current.volume = Math.min(100, Math.max(0, vol)); this.saveGlobalSettings();
  },
  setLanguage(lang){
    if(!this.LANGUAGES.includes(lang)) return;
    this.current.language = lang; this.saveGlobalSettings();
  },

  downloadSave(){
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    const a = document.createElement('a');
    a.href = url;
    a.download = `beyond-the-gate-save-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // Retorna uma Promise: resolve quando o save do arquivo é aplicado e
  // persistido, ou rejeita com uma mensagem legível (arquivo inválido etc.)
  uploadSaveFromFile(file){
    return new Promise((resolve, reject)=>{
      if(!file){ reject('Nenhum arquivo selecionado.'); return; }
      if(file.size > this.MAX_SAVE_FILE_BYTES){ reject('Arquivo grande demais para ser um save do Beyond the Gate.'); return; }
      const reader = new FileReader();
      reader.onload = ()=>{
        let loaded;
        try{ loaded = JSON.parse(reader.result); }
        catch(e){ reject('Não foi possível ler o arquivo (JSON inválido).'); return; }
        if(typeof loaded !== 'object' || loaded === null || typeof loaded.gold !== 'number'){
          reject('Arquivo não parece ser um save válido do Beyond the Gate.');
          return;
        }
        SaveModule.applyLoaded(loaded);
        SaveModule.save();
        // igual ao boot(): só spawna monstro se o save trazia uma Dungeon
        // ativa, senão mostra a cidade (currentDungeon fica null)
        if(state.currentDungeon){
          MonsterModule.spawn(false);
          UI.showDungeonView();
        } else {
          MonsterModule.current = null;
          UI.showCityView();
        }
        UI.renderPlayerName();
        UI.renderAll();
        resolve();
      };
      reader.onerror = ()=> reject('Falha ao ler o arquivo.');
      reader.readAsText(file);
    });
  }
};
