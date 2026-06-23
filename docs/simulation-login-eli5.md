# How Simulation Login Works — Explain Like I'm 5

Imagine our app needs to talk to **two different clubhouses**.

## The two clubhouses

🏠 **Clubhouse A — the "real" one (OMS)**
This is where all the normal stuff happens. When you logged into the app, the
front door gave you a **wristband** (a "Bearer token"). Flash the wristband, and
the guard at Clubhouse A lets you in everywhere.

🏚️ **Clubhouse B — the "what-if" one (Simulation)**
This is a *separate* clubhouse where we run pretend experiments — "what if we
routed orders this other way?" The catch: **Clubhouse B's guard doesn't
recognize Clubhouse A's wristband.** Different clubhouse, different rules.

## So how do we get into Clubhouse B?

Clubhouse B has its own secret password. When the app needs to go there, it
walks up to the door and does this:

1. **Knocks and whispers the password.** The app sends a username and password
   (kept in a settings file called `.env`) to a special door called
   `order-routing/login`.
2. **Gets a special stamp.** The guard checks the password and hands back a hand
   stamp called an **`api_key`**. Now the app is allowed in.
3. **Shows the stamp every time.** From then on, every time the app asks
   Clubhouse B for something, it shows the stamp. No stamp, no entry.

That's the whole login. There's **no login screen you click** — the app does all
of this quietly by itself.

## A few clever bits

🧠 **It remembers the stamp.**
The app doesn't get a new stamp every single time — that would be silly. It keeps
the stamp in its pocket and reuses it. (But only in its pocket for *right now* —
if you refresh the page, the pocket is empty and it gets a new stamp.)

⏰ **It gets a new stamp a little early.**
Stamps wash off after a while. The app is smart: about a minute *before* the
stamp would stop working, it goes and gets a fresh one, so it never gets stuck at
the door with a faded stamp.

🙋 **Even if ten things ask at once, it only logs in once.**
If a bunch of parts of the app all need into Clubhouse B at the same moment, they
don't each go knock separately. They all wait for **one** trip to the door and
share the same stamp.

🔁 **If the guard says "this stamp is no good," it tries again — once.**
Sometimes a stamp goes stale and the guard says no. The app shrugs, throws the
old stamp away, goes and gets a brand-new one, and tries the door one more time.
If it still doesn't work, *then* it gives up and tells you something went wrong.

## The big switch

Here's the twist: **sometimes there's only ONE clubhouse.**

In the real, live version of the app (UAT/prod), the "what-if" experiments
happen inside the *same* Clubhouse A as everything else. So there's no second
door to knock on — the app just uses the wristband it already has.

There's a single setting called **`VITE_SIM_URL`** that decides this:

- **Setting is empty** → "There's only one clubhouse." Use the wristband. Skip
  the whole password-and-stamp dance.
- **Setting has an address in it** → "There's a separate what-if clubhouse over
  there." Go do the password-and-stamp dance.

## One-sentence version

> The app keeps a wristband for the main clubhouse, but the simulation clubhouse
> is separate and needs its own password — so the app quietly logs in there with
> a password from its settings, gets a hand stamp (`api_key`), reuses and
> refreshes that stamp automatically, and only does any of this when a setting
> says the simulation clubhouse is a separate building.
</content>
</invoke>
