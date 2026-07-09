/* ---------------------------------------------------------------------
   SETTINGS MODULE (settings.js)
   Baixar/carregar save como arquivo, e preferências de áudio/idioma.
   Áudio e idioma são só placeholders por enquanto — guardam a preferência
   no save, mas não existe sistema de áudio nem tradução ainda no jogo.
--------------------------------------------------------------------- */
const SettingsModule = {
  downloadSave(){
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    const a = document.createElement('a');
    a.href = url;
    a.download = `monster-attack-clicker-save-${stamp}.json`;
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
      const reader = new FileReader();
      reader.onload = ()=>{
        let loaded;
        try{ loaded = JSON.parse(reader.result); }
        catch(e){ reject('Não foi possível ler o arquivo (JSON inválido).'); return; }
        if(typeof loaded !== 'object' || loaded === null || typeof loaded.gold !== 'number'){
          reject('Arquivo não parece ser um save válido do Monster Attack Clicker.');
          return;
        }
        SaveModule.applyLoaded(loaded);
        SaveModule.save();
        MonsterModule.spawn(true);
        UI.renderAll();
        resolve();
      };
      reader.onerror = ()=> reject('Falha ao ler o arquivo.');
      reader.readAsText(file);
    });
  },

  setAudioEnabled(enabled){ state.settings.audioEnabled = enabled; SaveModule.save(); },
  setVolume(vol){ state.settings.volume = vol; SaveModule.save(); },
  setLanguage(lang){ state.settings.language = lang; SaveModule.save(); }
};
