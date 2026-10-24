# Wireframe spec: what each screen needs

Source: the four "Matric Pathways — Wireframes" PDFs, all pages, read from their text.
Where a wireframe shows a placeholder in [brackets], it is data to be supplied by the
API; the wireframe does not give a value.

Tabs on every signed-in page: Home · Funding · Study · Work · Profile.

## Start and welcome

### Logo / welcome (`/splash`)
- Logo box (dashed, placeholder).
- Headline: "Your marks. Your plan A and plan B."
- Body: "See which courses, colleges, funding and work you qualify for, then apply on the official sites."
- Buttons: "Check my options — no account needed" → APS calculator; "Sign in or create an account" → sign-in; "Just calculate my APS" → APS calculator.
- Footer: "Free for every learner. How we use your data" (link).

### How we use your data (`/how-we-use`)
- Title "In plain words".
- Cards: What we collect (email, first name, date of birth and province; school marks and subjects; courses, funding and work saved or tracked; never ID number, banking details, race or income). Why (Plan B, deadline reminders chosen). Who sees it (only you; not sent to universities or funders; AI explanations get the result, never the name). Your rights (download or delete in Profile › My data; under 18 a parent or guardian approves).
- Footer: "Questions: [privacy contact email] · Policy version [1.0]".
- Button: "Got it".

## Sign in

### Enter your email (`/sign-in`)
- Body: "We'll email you a 6-digit code. No password to remember. New here? This creates your account."
- Field: email. Button: "Send my code".
- Card: "No email address?" — "You can use every feature as a guest. Your marks stay on this phone." Link: "Continue as a guest".
- Note: "Using a shared or school computer? Sign out when you're done."
- Link: "How we use your data".

### Enter your code (`/sign-in-code`)
- Body: "We sent a 6-digit code to [masked email]. Check spam if you can't see it."
- Six digit boxes. Error line when wrong: "That code didn't match. 2 tries left."
- Button: "Continue". Resend: "Resend code in 0:24" (countdown, then "Resend code").
- Link: "Use a different email".

### One quick question (birthday)
- Title "When were you born?". Day, Month, Year selects.
- Card "Why we ask for the date, not your age": "So the app knows when you turn 18 without asking again. We don't use it for anything else."
- Button: "Continue".

### You're under 18 (`/onboarding`, under-18 branch)
- Title "You can still use everything". Body: "Check your APS, see Plan A and Plan B, and find funding and work — right now."
- Card "Keep going as a guest": "Your marks stay on this phone. Nothing about you is saved on our servers." Button "Continue as a guest".
- Card "Save your plan with a parent's OK": "To save across phones, track applications and get reminders, a parent or guardian approves by email." Fields: parent or guardian's email; "They are my" — Parent / Legal guardian (choice). Button "Send approval request". Note: "We only use their email to send this request."

### Parent approval — request sent (`/onboarding`, after sending)
- Heading "Request sent to [masked email]". Body: "When your parent or guardian taps Approve, your account opens and your plan is saved."
- Card Status: "Waiting", "Sent today at [time] · link works for 7 days".
- Card "What happens next": 1. They open the email and read what we store. 2. They confirm they're your parent or guardian. 3. They tap Approve. You'll get a notification.
- Buttons: "Keep using as a guest"; "Resend the email"; link "Use a different email".

### Your choices (`/onboarding`, consents)
- Title "You decide what we use". Body "Change any of these later in Settings."
- "Save my account" — tag "Needed to save". Body: "We keep your marks, saved items and applications so the app can match you. Download or delete them any time."
- "Explain my results with AI" (toggle). Body: "We send your result — never your name or contact details — to an AI service that may be outside South Africa. Off: you get a standard explanation."
- "Deadline reminders by email" (toggle). Body: "Only about courses and funding you saved. Never adverts."
- Link "Read the full privacy notice". Button "Agree and continue".
- Not in the wireframe, kept in the build: "Use my NBT results" and "Help me write a CV or letter" (optional, off by default).

### About you — step 1 of 3 (`/onboarding`)
- Title "A few basics". Field: First name. "Province you live in" (chips, note: "Used to show nearby colleges first. We never limit you to one province.").
- "Which certificate are you writing?" — chips: NSC, IEB, SACAI, NC(V).
- Note: "We don't ask for your ID number, income or race." Button "Continue".

### Interests — step 2 of 3 (`/onboarding`)
- Title "What would you enjoy?". Body: "Pick up to 3. This only changes the order of results — never what you qualify for."
- Chips (pick up to 3): IT and computers; Engineering; Health and nursing; Business and finance; Teaching; Law; Arts and design; Science; Hospitality and tourism; Agriculture; Trades and technical; Public service.
- Counter: "[n] of 3 picked". Button "Continue". Link "Not sure yet — skip".

### Your marks — step 3 of 3 (`/onboarding`)
- Title "Add your marks". "Which results are these?" (period).
- Rows: subject name + mark % + remove (×). "+ Add a subject".
- Summary card: "APS [n] at most universities" — "Best 6 subjects, Life Orientation not counted. Wits and UCT score differently — see My scores."
- Button "See my options".

## Home

### Home (`/`)
- Greeting "Good [time of day], [first name]". Line "Your next deadline closes in [n] days." Button "Update my marks".
- Card "Your Plan B is ready" — pill "[n] routes". Body: "[programme] needs [subject]. Here are [n] routes that still get you into [field]." Link "See my plan".
- Tip strip: "Tip: no real bursary, college or job asks you to pay to apply." (rotating dots in the wireframe).
- "UPCOMING DEADLINES" with "See all". Horizontal cards: institution or bursary name, closes date and time, "[n] days left" pill.
- Card "YOUR NEXT STEP": action title, detail "[n] document(s) left on your [institution] application".

## Funding

### Funding (`/funding`)
- Title "Funding". Search field.
- Filter chips: Open now (selected); IT; Bursaries; Loans; Scholarships.
- Featured card: NSFAS, "Closes 31 Oct" pill. Body: "Government funding for public universities and TVET colleges. You may qualify if your household earns R350,000 a year or less (R600,000 with a disability), or gets a SASSA grant." Button "Check and apply on myNSFAS".
- "MATCHES FOR YOU · [n]": cards with name, provider, closing date, tag (Likely match; May qualify; Loan), check lines (✓ field matched; ? income — check with provider).

### Bursary detail (`/opportunity/[id]`)
- Name; "[provider] · undergraduate · full-time study"; pills "Open", "Closes [date]".
- "DO YOU QUALIFY?": ✓ / ? lines with notes ("You picked IT and qualify for 3 IT courses"; "Yours: 69% (June)"; "We don't ask this — check with the provider").
- "WHAT IT COVERS": [tuition, books, accommodation — as listed on the provider's page].
- Card "Never pay to apply": "Real bursaries are free to apply for. Only use the link below."
- "Source: [provider website] · checked [date]".
- Buttons: "Apply on [provider].co.za" (primary); "Save".

## Study

### Study (`/study`)
- Title "Study". Card: "APS [n] at most universities", "Wits and UCT count differently", link "My scores".
- Search field. Level chips: IT (selected); Degree; Diploma; Higher cert.; TVET.
- "IT COURSES · [n]": cards with name, status tag ("Subjects short", "You qualify"), "[institution] · [level] · closes [date]".
- "INSTITUTIONS": short-name pills: UJ, Wits, UP, TUT, UCT, UKZN.

### University (`/institution/[id]`)
- Logo placeholder; name; "Public university · [province]".
- Pills: "Open · [n] days left", "Applies directly".
- Card "How to apply for [year]": Where (university's own website); Fee ("Free online"); Choices ("[n], can't change later"); Closes ("[date, time]").
- Button "Open [university]'s application site" with domain under it.
- Card "How [university] scores you": "Best 6 subjects, Life Orientation not counted. Your APS here: [n]."
- "YOUR MATCHES AT [university] · [n]": course cards with status tag.
- Source line: "Source: [domain], important information before you apply · checked [date]".

### Course (`/programme/[id]`)
- Name; "[university] · [level]".
- Banner (grey card): status line ("Score met · subjects short"); explanation ("Your APS is enough, but this course needs Mathematics. You take Mathematical Literacy.").
- "EVERY CHECK": rows ✓ / ✕ / ?: APS [min] or more (Yours: [n]); Mathematics [x]% or more (You take …); English [x]% or more (Yours: [n]%); Applications open (Closes [date]).
- Note: "Based on your Grade 12 June marks and published minimums. [University] decides who gets a place."
- Buttons: "Ask about this"; "See Plan B". Link: "Track this application anyway".
- Source line: "Source: [university] prospectus, p. [x] · checked [date]".

### Why this result (`/why/[id]`)
- Title "Why this result" with close (×). Course name and university.
- Body: "Your score of [n] is enough for this course. But it needs [subject], and you take [subject], so the subject rule isn't met."
- "WHAT YOU CAN DO NEXT": one or more alternative programmes with the reason.
- Note: "Explained by AI from the checks on the course page. It can't change the result — only [university] decides who gets a place."
- Links: "See my Plan B"; "Talk to a person — [helpline] [number]".

### APS calculator (`/aps`)
- Title "APS calculator". "No account needed. Nothing you type is saved."
- Rows: subject (name) + mark % + remove; "+ Add a subject".
- Summary block: "Most universities · best 6, no LO — [n] / 42"; "Wits · best 7 incl. LO, bonuses — [score]"; "UCT · % points, best 6 — [n] / 600".
- Button "See courses I qualify for". Link "How APS works".

### My scores (`/scores`)
- Title "My scores". Body: "Each university scores your marks its own way. These use your Grade 12 June marks."
- One row per university: name; scheme description ("Best 6 subjects, Life Orientation not counted"; "Best 7 incl. Life Orientation (max 4), bonus for English and Maths"; "Raw % of best 6, out of 600 · NBT also needed for some faculties"); score pill. Universities: UJ, UP, TUT, Wits, UCT, UKZN.
- Card "Not listed?": "We only show scores we've checked. Use the university's own calculator." Button "Check site".
- Footer: "A score shows you meet a minimum. Universities with selection may still ask for more."

## Work

### Work and skills (`/work`)
- Title "Work and skills". Filter chips: All (selected); Learnerships; Internships; Government.
- Featured card: SA Youth. Body: "Free, data-free site with jobs and learning for young people across the country." Button "Open sayouth.mobi".
- "MATCHES FOR YOUR INTERESTS · IT": cards with tag (Open; Not open now; Closed; Weekly).
- Card detail: "[provider] · matric needed · closes [date]" or the status note ("Advertised once a year · we'll remind you"; "2027 intake ran 16 Feb – 27 Mar 2026 · we'll remind you").

### Opportunity (`/opportunity/[id]`), job
- Name; "[provider] · [kind]"; pills "Not open now", "Yearly intake".
- "USUAL REQUIREMENTS — CHECK EACH ADVERT": ✓ / ? lines with notes (e.g. "Recent adverts said 18–35; older pages say 18–30").
- "HOW TO APPLY": one line with the only official route.
- Scam warning card: "SAPS never charges a fee to apply or to 'fast-track' you. Fake recruitment adverts spread on WhatsApp and Facebook."
- Button "Remind me when it opens". Source line: "Source: [site] careers · checked [date]".

## Saved and Applications

### Saved (`/saved`)
- Title "Saved". Tabs: All [n]; Courses; Funding; Work.
- Cards with tag (COURSE / FUNDING / WORK), name, "Remove" link, "[institution or provider] · closes [date]" or "Not open now · reminder on".
- Footer: "Tap Save on any course, bursary or opportunity to keep it here."

### My applications (`/applications`)
- Count tiles: Planning [n], Submitted [n], Offers [n].
- Sections SUBMITTED and PLANNING. Cards: name, status pill ("Submitted"; "Closes 31 Oct"; "Closes [date]"), reference line "Ref: [reference] · [n] of [m] documents", progress bar.
- Footer: "We never apply for you. After you apply on the official site, update the status here."
- Button "+ Track something new".

### Application (`/application/[id]`)
- Title = name; "[institution] · closes [date, time]".
- Status select (Submitted, etc.); "Submitted on" date.
- "Your reference number" field.
- "DOCUMENTS · [n] OF [m]": checkbox rows (e.g. Certified copy of ID; Grade 11 final results; Grade 12 June results; Confirmation email saved; Residence application).
- "Notes" text area.
- Button "Open [institution]'s application site" with domain under it.

## Profile and account

### Profile (`/profile`)
- Avatar (initial letter, dashed circle). Name. Line "Gauteng · NSC · marks from Grade 12 June".
- "MY PLAN": My marks ("[n] subjects"); My scores ("APS [n]"); My plan A and B ("[n] routes"); My applications ("[n] tracked"); Saved ("[n] items").
- "ACCOUNT": Settings and choices; My data; Help and talk to a person.
- Button "Sign out".

### Signed-out profile (`/profile`)
- Title "Your profile". Body "Sign in to keep your plan, applications and reminders on any phone."
- Bullets: See what you qualify for, saved; Get reminders before deadlines close; Track every application in one place.
- Buttons: "Sign in"; "Create a free account"; note "Under 18? A parent or guardian approves by email."; "Manage my data".

### Save your plan? (guest prompt)
- Title "Save your plan?". "As a guest, your marks and plan stay on this phone only. A free account keeps them safe and adds:" — Your plan on any phone or computer; An application tracker with checklists; Deadline reminders, if you want them.
- Buttons: "Create a free account"; "Not now". Note: "Under 18? A parent or guardian approves your account by email."

### Settings (`/settings`)
- Section YOUR CHOICES: AI explanations (send results, never your name, to an AI service); Deadline reminders by email (only for things you saved); Low-data mode (no images, smaller downloads, saved lists).
- LANGUAGE: App language — English ›.
- ACCOUNT: Email (masked); Parent approval ("Not needed (18+)"); Privacy notice ›; Download or delete my data ›.
- Button "Sign out".

### My data (`/my-data`)
- Intro: "See, download or delete everything we hold about you. This is your right under South Africa's privacy law (POPIA)."
- "What we hold": Account — email, first name; Profile — date of birth, province; Marks — [n] result sets; Saved — [n] items; Applications — [n] tracked; Choices — [n] settings, with dates.
- Button "Download my data" with note "A file you can open on your phone or computer."
- Card "Delete my account": "This removes your account and everything above. It can't be undone. You can still use the app as a guest." Button "Delete my account".
- Footer: "Questions or complaints: [privacy contact email]. You can also contact the Information Regulator."

### Help (`/help`)
- Section GUIDES (rows with ›): How APS works; NSFAS or a bursary — what's the difference?; Degree, diploma, higher certificate, TVET; What to do if you don't get in.
- Card "How to spot a scam": real applications are free or paid only to the institution; nobody can guarantee a place or a bursary; never share passwords or banking details.
- Section TALK TO A PERSON: Khetha career helpline (DHET) — free career and study advice — call 086 999 0123, SMS 072 204 5056; Central Application Service (DHET) — help finding a place to study — WhatsApp 081 308 4196.

### Privacy notice (`/privacy`)
- Full notice. The wireframe gives the link text "Privacy notice" from several screens.

## Guardian (parent) approval

### Approve (`/guardian/[token]`)
- Brand "Matric Pathways". Title "[learner] asked you to approve their account" (wireframe: "Thandi asked you to approve her account").
- Body: "Matric Pathways helps learners see which courses, funding and work they qualify for. They apply on the official sites themselves."
- Card "If you approve, we will keep": their first name, date of birth and province; their school marks; courses, funding and applications they save; reminder emails, only if they turn them on.
- Card "We never": ask for ID numbers, income or banking details; send their details to universities or funders; show them adverts.
- Checkbox: "I am [learner]'s parent or legal guardian".
- Buttons: "Decline"; "Approve" (needs the checkbox).
- Note: "You can withdraw and delete their data any time using the link in your email." Link "Privacy notice".

### Approved (after Approve)
- Tick. "Thank you. [learner]'s account is open."
- Body: "We've let them know. Keep this email — its link lets you see or delete their data later."
- "Changed your mind?" — "Withdrawing deletes their saved account. They can still use the app as a guest." Button "Withdraw approval and delete data".
- "Want a copy of what we hold?" Button "Download their data".
- Footer: "Approved [date and time] · policy version [1.0]".

## Errors and states

### Page not found (`/+not-found`)
- "We can't find that page". Body: "The link may be old, or the course or bursary may have been removed after its closing date."
- Buttons: "Go to Home"; "Search courses".

### Offline (banner state on Home)
- "You're offline. Showing what was saved on [date]. Retry".
- Note: "Your plan and deadlines still work offline."
- Disabled items: "Update my marks — needs internet", "Not available offline".
- Note: "AI explanations, searching new courses and opening application sites. They come back when you reconnect."

### Maintenance (`/maintenance`)
- "We're updating the app". "We'll be back in a few minutes. Your saved marks, plan and applications are safe."
- Note "Deadlines don't stop: if you were about to apply, go straight to the official site — you don't need our app to submit."
- Button "Try again". Link "Updates: [status page address]".

### Something went wrong (`/error`)
- "Something went wrong". "It's not your fault and nothing you saved was lost. Please try again."
- "If it keeps happening, send us this code so we can find the problem: REF [code]" (a reference code is shown).
- Buttons: "Try again"; "Go to Home"; "Contact support".

## Things the wireframes do not give (must come from the API or a decision)
- Real values in [brackets]: names, dates, counts, institutions, provider names, contact details, status page address, privacy contact email, reference codes.
- "Logo": the wireframe shows a placeholder box only; the real logo is not supplied.
- SA Youth and NSFAS details: the wireframes show the given text; live data comes from the handoffs.
- Count and percentage rules: the APS and UCT/Wits score rules are in the engine, not the wireframe.
- Tip rotation on Home: the wireframe shows one tip and dots; the list of tips is not given.
- Languages: the wireframe shows English only.
