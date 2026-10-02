import json, urllib.request, urllib.error, urllib.parse, random, string
K="AIzaSyB7UPMwlJ28K2h4DTyBKJhm0gsBwTgqOuM"; SITE="https://yaya6411.github.io/Site-test-A/"
P="projects/test-biblio-998a1/databases/(default)/documents"; FS="https://firestore.googleapis.com/v1/"+P; IT="https://identitytoolkit.googleapis.com/v1"
q=lambda s: urllib.parse.quote(s, safe="")
def call(url, body=None, method=None, token=None):
    h={"Content-Type":"application/json","Referer":SITE}
    if token: h["Authorization"]="Bearer "+token
    url+=("&" if "?" in url else "?")+"key="+K
    req=urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ("POST" if body is not None else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=25) as r: return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read())
        except Exception: return e.code, {}
def V(v):
    if isinstance(v,bool): return {"booleanValue":v}
    if isinstance(v,int): return {"integerValue":str(v)}
    if isinstance(v,list): return {"arrayValue":{"values":[V(x) for x in v]}}
    if isinstance(v,dict) and "ts" in v: return {"timestampValue":v["ts"]}
    return {"stringValue":v}
F=lambda d:{k:V(v) for k,v in d.items()}
doc=lambda path: f"{P}/{path}"
def commit(writes, tok=None): return call(f"{FS}:commit", {"writes":writes}, token=tok)[0]
def patch(path, data, tok=None): return call(f"{FS}/{'/'.join(q(x) for x in path.split('/'))}?"+"&".join("updateMask.fieldPaths="+k for k in data), {"fields":F(data)}, "PATCH", tok)[0]
def get(path, tok=None): return call(f"{FS}/{'/'.join(q(x) for x in path.split('/'))}", token=tok)[0]
def delete(path, tok=None): return call(f"{FS}/{'/'.join(q(x) for x in path.split('/'))}", method="DELETE", token=tok)[0]
def acct():
    e="test-verif-"+"".join(random.choices(string.ascii_lowercase,k=8))+"@example.com"
    s,d=call(f"{IT}/accounts:signUp", {"email":e,"password":"MotDePasse-Test-123","returnSecureToken":True}); return d["idToken"], d["localId"]
results=[]
def check(label, got, ok):
    good = got in ok if isinstance(ok,(list,tuple,set)) else got==ok
    results.append(good); print(f"{'✔' if good else '✘'} {label} ({got})")
NOW={"ts":"2026-10-02T12:00:00Z"}
tA,A=acct(); tB,B=acct(); tag="".join(random.choices(string.ascii_lowercase,k=4))
nA=f"ZzTest {tag}"; lA=nA.lower(); nA2=f"ZzTest {tag} bis"; lA2=nA2.lower()
prof=lambda n: F({"name":n,"nameLower":n.lower(),"createdAt":NOW,"photoURL":""})
mask=["name","nameLower","createdAt","photoURL"]
print("— Pseudos et profils")
check("A réserve son pseudo et crée son profil", commit([{"update":{"name":doc(f"usernames/{lA}"),"fields":F({"uid":A})},"currentDocument":{"exists":False}},{"update":{"name":doc(f"users/{A}"),"fields":prof(nA)},"updateMask":{"fieldPaths":mask}}],tA), 200)
check("B ne peut pas prendre le même pseudo", commit([{"update":{"name":doc(f"usernames/{lA}"),"fields":F({"uid":B})},"currentDocument":{"exists":False}},{"update":{"name":doc(f"users/{B}"),"fields":prof(nA)},"updateMask":{"fieldPaths":mask}}],tB) != 200, True)
check("B ne peut pas utiliser ce pseudo sans réservation", patch(f"users/{B}", {"name":nA,"nameLower":lA,"createdAt":NOW,"photoURL":""}, tB), 403)
check("A change de pseudo (réserve le nouveau, libère l'ancien)", commit([{"update":{"name":doc(f"usernames/{lA2}"),"fields":F({"uid":A})},"currentDocument":{"exists":False}},{"update":{"name":doc(f"users/{A}"),"fields":prof(nA2)},"updateMask":{"fieldPaths":mask}},{"delete":doc(f"usernames/{lA}")}],tA), 200)
check("l'ancien pseudo est libéré", get(f"usernames/{lA}"), 404)
check("B ne peut pas supprimer le pseudo de A", delete(f"usernames/{lA2}", tB), 403)
check("A choisit un avatar", patch(f"users/{A}", {"avatar":"🦊"}, tA), 200)
check("avatar trop long refusé", patch(f"users/{A}", {"avatar":"x"*40}, tA), 403)
print("— Avis")
key="test verif|claude"
check("avis d'un compte à l'e-mail non vérifié refusé", commit([{"update":{"name":doc(f"reviews/{A}__{key}"),"fields":F({"uid":A,"bookKey":key,"title":"Test","rating":4,"name":nA2,"comment":"x"})},"currentDocument":{"exists":False},"updateTransforms":[{"fieldPath":"createdAt","setToServerValue":"REQUEST_TIME"}]}],tA), 403)
print("— Bibliothèque")
entry={"title":"Test","authors":["X"],"cover":"","isbn":"","year":"","pages":0,"status":"read","favorite":True,"addedAt":NOW,"updatedAt":NOW}
check("A ajoute un livre à sa bibliothèque", patch(f"users/{A}/library/{key}", entry, tA), 200)
check("statut invalide refusé", patch(f"users/{A}/library/{key}", {**entry,"status":"pirate"}, tA), 403)
check("B ne peut pas écrire dans la bibliothèque de A", patch(f"users/{A}/library/{key}", entry, tB), 403)
check("bibliothèque de A privée par défaut (lecture par B refusée)", get(f"users/{A}/library/{key}", tB), 403)
check("A rend sa bibliothèque visible", patch(f"users/{A}", {"showLibrary":True}, tA), 200)
check("bibliothèque de A alors lisible par B", get(f"users/{A}/library/{key}", tB), 200)
print("— Listes")
lst={"name":"Liste test","public":False,"items":[],"createdAt":NOW,"updatedAt":NOW}
check("A crée une liste privée", patch(f"users/{A}/lists/l1", lst, tA), 200)
check("liste privée illisible par B", get(f"users/{A}/lists/l1", tB), 403)
check("A rend la liste publique", patch(f"users/{A}/lists/l1", {**lst,"public":True}, tA), 200)
check("liste publique lisible sans compte", get("users/"+A+"/lists/l1"), 200)
check("B ne peut pas modifier la liste de A", patch(f"users/{A}/lists/l1", {**lst,"name":"Piratée"}, tB), 403)
print("— Abonnements")
now=[{"fieldPath":"createdAt","setToServerValue":"REQUEST_TIME"}]
check("B suit A", commit([{"update":{"name":doc(f"users/{B}/following/{A}"),"fields":{}},"updateTransforms":now},{"update":{"name":doc(f"users/{A}/followers/{B}"),"fields":{}},"updateTransforms":now}],tB), 200)
check("abonnés de A lisibles publiquement", get(f"users/{A}/followers/{B}"), 200)
check("B ne peut pas faire suivre B par A à sa place", commit([{"update":{"name":doc(f"users/{A}/following/{B}"),"fields":{}},"updateTransforms":now},{"update":{"name":doc(f"users/{B}/followers/{A}"),"fields":{}},"updateTransforms":now}],tB), 403)
check("B ne peut pas créer un abonné seul (sans l'abonnement)", commit([{"update":{"name":doc(f"users/{A}/followers/{B}x"),"fields":{}},"updateTransforms":now}],tB), 403)
check("B se désabonne", commit([{"delete":doc(f"users/{B}/following/{A}")},{"delete":doc(f"users/{A}/followers/{B}")}],tB), 200)
print("— Signalements et modération")
rid=f"{A}__{key}"
check("signalement avec un motif invalide refusé", commit([{"update":{"name":doc(f"reports/{B}__{rid}"),"fields":F({"reviewId":rid,"reviewUid":A,"bookKey":key,"title":"TEST","reason":"pirate","reporterUid":B})},"currentDocument":{"exists":False},"updateTransforms":now}],tB), 403)
check("signalement au nom d'un autre refusé", commit([{"update":{"name":doc(f"reports/{A}__{rid}"),"fields":F({"reviewId":rid,"reviewUid":A,"bookKey":key,"title":"TEST","reason":"spam","reporterUid":A})},"currentDocument":{"exists":False},"updateTransforms":now}],tB), 403)
check("lecture des signalements refusée à un non-modérateur", call(f"{FS}:runQuery", {"structuredQuery":{"from":[{"collectionId":"reports"}],"limit":1}}, token=tB)[0], 403)
check("masquer un avis refusé à un non-modérateur", patch(f"reviews/{rid}", {"hidden":True}, tB), [403,404])
check("A peut vérifier son propre statut modérateur (non)", get(f"admins/{A}", tA), 404)
check("A ne peut pas lire le statut d'un autre", get(f"admins/{B}", tA), 403)
print("— Nettoyage")
for path,tok in [(f"users/{A}/lists/l1",tA),(f"users/{A}/library/{key}",tA),(f"usernames/{lA2}",tA),(f"users/{A}",tA)]: print(" ", path.split('/')[0], delete(path,tok))
for t in (tA,tB): print("  compte", call(f"{IT}/accounts:delete", {"idToken":t})[0])
print(f"\n{sum(results)}/{len(results)} vérifications réussies")
