# ArianeAI – Journal d'installation (FR / EN)

## 🇫🇷 Version Française

### 📅 Journée d'installation – Résumé complet

Cette journée marque la création de **ArianeAI**, ton IA souveraine fonctionnant entièrement en local sur ton Dell Optiplex 3020. Voici la documentation complète des étapes réalisées.

---

## 🖥️ 1. Installation de Linux Mint 21.3 « Virginia »

- Téléchargement de l’ISO Linux Mint 21.3 (édition Cinnamon)
- Création d’une clé USB bootable via Rufus
- Boot sur la clé & installation en **dual-boot avec Windows 10**
- Linux détecte automatiquement ta carte Wi-Fi Intel
- Mises à jour systèmes effectuées

---

## 🤖 2. Installation d’Ollama

Commande utilisée :

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Test du modèle local :

```bash
ollama run llama3
```

Le modèle **llama3:latest (Q4)** fonctionne correctement.

---

## 🌐 3. Configuration d’Ollama pour l'accès réseau

Modification du service systemd :

Fichier : `/etc/systemd/system/ollama.service`

Ajout :

```ini
Environment="OLLAMA_HOST=0.0.0.0"
ExecStart=/usr/local/bin/ollama serve
```

Puis :

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

Test local :

```bash
curl http://localhost:11434/api/tags
```

Test depuis une autre machine :

```bash
curl http://192.168.2.110:11434/api/tags
```

---

## 🔥 4. Premier appel Nuxt → Dell → Ollama

Création d’un endpoint Nuxt :

`server/api/ai/generate.post.ts`

```ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const response = await $fetch('http://192.168.2.110:11434/api/generate', {
    method: 'POST',
    body: {
      model: 'llama3',
      prompt: body.prompt,
      stream: false
    }
  })

  return response
})
```

Test côté front :

```ts
const { data } = await useFetch('/api/ai/generate', {
  method: 'POST',
  body: { prompt: 'Test depuis Nuxt' }
})
console.log(data.value)
```

Résultat : **Succès !**

---

## 🔒 5. Sécurisation réseau (UFW)

```bash
sudo apt install ufw -y
sudo ufw allow from 192.168.2.0/24 to any port 11434
sudo ufw enable
```

---

## 🎉 Conclusion

Tu disposes maintenant de :

- Une machine Linux prête pour servir d'IA locale  
- Ollama configuré proprement  
- Un endpoint Nuxt opérationnel  
- Une architecture de base pour **ArianeAI**, ton IA souveraine  

---

# 🇬🇧 English Version

### 📅 Installation Day – Full Documentation

This day marks the creation of **ArianeAI**, your fully local sovereign AI running on your Dell Optiplex 3020. Below is the full documentation.

---

## 🖥️ 1. Installing Linux Mint 21.3 “Virginia”

- Downloaded Linux Mint 21.3 ISO (Cinnamon edition)
- Created bootable USB with Rufus
- Booted and installed in **dual-boot with Windows 10**
- Intel Wi-Fi card automatically detected
- Completed system updates

---

## 🤖 2. Installing Ollama

Command used:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Test model:

```bash
ollama run llama3
```

Result: **llama3:latest (Q4)** works correctly.

---

## 🌐 3. Configuring Ollama for LAN access

Edited systemd service:

`/etc/systemd/system/ollama.service`

Added:

```ini
Environment="OLLAMA_HOST=0.0.0.0"
ExecStart=/usr/local/bin/ollama serve
```

Reloaded & restarted:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

Local test:

```bash
curl http://localhost:11434/api/tags
```

Remote test:

```bash
curl http://192.168.2.110:11434/api/tags
```

---

## 🔥 4. First Nuxt → Dell → Ollama request

Nuxt API route:

```ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const response = await $fetch('http://192.168.2.110:11434/api/generate', {
    method: 'POST',
    body: {
      model: 'llama3',
      prompt: body.prompt,
      stream: false
    }
  })

  return response
})
```

Client-side test:

```ts
const { data } = await useFetch('/api/ai/generate', {
  method: 'POST',
  body: { prompt: 'Test from Nuxt' }
})
console.log(data.value)
```

Result: **Success!**

---

## 🔒 5. Firewall configuration

```bash
sudo apt install ufw -y
sudo ufw allow from 192.168.2.0/24 to any port 11434
sudo ufw enable
```

---

## 🎉 Conclusion

You now have:

- A fully functioning Linux server  
- Ollama running and reachable over LAN  
- Nuxt properly connected to your AI backend  
- A stable foundation for **ArianeAI**, your sovereign AI  

---

## 📄 End of Documentation
