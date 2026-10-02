(function(){
  function mkUser(e){ return {uid:'u123', metadata:{creationTime:'Mon, 01 Sep 2026 10:00:00 GMT'}, email:e, displayName:null, emailVerified:false, photoURL:null, providerData:[{providerId:'password'}],
    getIdToken:()=>Promise.resolve('tok-u123'), reload(){ this.emailVerified = !!window.__verifyOnReload; return Promise.resolve(); }, updateProfile(p){Object.assign(this,p);return Promise.resolve()}, sendEmailVerification:()=>Promise.resolve(), delete(){window.__deleted=true;return Promise.resolve()}}; }
  const a={currentUser:null, languageCode:'', _l:[], onAuthStateChanged(fn){this._l.push(fn); setTimeout(()=>fn(this.currentUser),10)}, getRedirectResult:()=>Promise.resolve(),
    _emit(){this._l.forEach(f=>f(this.currentUser))},
    createUserWithEmailAndPassword(e,p){ if(e==='taken@x.fr') return Promise.reject({code:'auth/email-already-in-use'}); this.currentUser=mkUser(e); this._emit(); return Promise.resolve({user:this.currentUser}); },
    signInWithEmailAndPassword(e,p){ if(p!=='goodpass1') return Promise.reject({code:'auth/invalid-credential'}); this.currentUser=mkUser(e); this.currentUser.displayName='Yaya'; this.currentUser.emailVerified=true; this._emit(); return Promise.resolve({user:this.currentUser}); },
    signOut(){ this.currentUser=null; this._emit(); return Promise.resolve(); }, sendPasswordResetEmail(){return Promise.resolve()}};
  window.firebase={initializeApp(){}, auth:Object.assign(()=>a,{GoogleAuthProvider:function(){}})};
})();
