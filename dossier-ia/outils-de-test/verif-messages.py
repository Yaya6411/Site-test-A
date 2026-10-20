import json, urllib.request, uuid
P="test-biblio-998a1"; K="AIzaSyB7UPMwlJ28K2h4DTyBKJhm0gsBwTgqOuM"
B=f"https://firestore.googleapis.com/v1/projects/{P}/databases/(default)/documents"
H={"Content-Type":"application/json","Referer":"https://yaya6411.github.io/Site-test-A/"}
def req(url, body=None, method=None):
    r=urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=H, method=method or ("POST" if body is not None else "GET"))
    try:
        with urllib.request.urlopen(r) as f: return f.status
    except urllib.error.HTTPError as e: return e.code
def create(fields, transform=True):
    w={"update":{"name":f"projects/{P}/databases/(default)/documents/messages/verif-{uuid.uuid4()}","fields":{k:{"stringValue":v} for k,v in fields.items()}},"currentDocument":{"exists":False}}
    if transform: w["updateTransforms"]=[{"fieldPath":"createdAt","setToServerValue":"REQUEST_TIME"}]
    return req(f"{B}:commit?key={K}", {"writes":[w]})
ok={"subject":"autre","body":"x"*20,"replyTo":"","uid":""}
tests=[
 ("lecture des messages sans être modérateur", lambda: req(f"{B}/messages?key={K}"), 403),
 ("sujet inconnu", lambda: create({**ok,"subject":"pub"}), 403),
 ("message trop court", lambda: create({**ok,"body":"court"}), 403),
 ("message trop long", lambda: create({**ok,"body":"x"*3001}), 403),
 ("champ en trop", lambda: create({**ok,"extra":"x"}), 403),
 ("se faire passer pour un compte", lambda: create({**ok,"uid":"quelquun"}), 403),
 ("date non fixée par le serveur", lambda: create(ok, transform=False), 403),
]
for name, fn, want in tests:
    got=fn(); print(("OK  " if got==want else "ÉCHEC"), name, "→", got)
