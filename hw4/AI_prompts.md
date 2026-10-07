# AI Prompt Log — Homework 4

Use this file to record the prompts used for each homework problem. Replace the bracketed placeholders with the exact problem information and prompts.

## Section 2 — Problem 2: Analyze the database

### Prompt 1

okay now for problem 2. looking at the campus_customs.db file, we will create a description of the database in an output/harness.md file. in that file so write down each table and its fields and one short line about why each field matters for the shop or the chatbot

### What I was lacking after the first prompt

Nothing was lacking

### Prompt 2

n/a

## Section 3 — Problem 3: Build the Campus Customs website

### Prompt 1

okay now for problem 3. build a react + vite + typescript front end for campus customs. put a navigation bar at the top with links to the main pages - Home, Products, About Us, Login, and Create Account. You can pull the wording for Home and About Us sections from https://yalebulldogblue.com/ but don't actually copy it make it more fun!! 
For the Products page, put product images from the catalgoue (use the image paths in the database) with basic product info like name, price, and short description. 
For each product, make it a single-item page (large image on one side and full product text on the other like description, prices, size/stock when you have them). when someone clicks on that card it should take them there to that single item page. 
also add a chat interface in the bottom right of the site (a floating chat panel). It does not need to talk to an agent yet but a stub that will call the backend later will be enough for this problem. Will also need a small api soon to read the database. start a simple FastAPI app in backend/main.py just to serve products and images which will then grow into the agent backend in problem 5 

### What I was lacking after the first prompt

The created website was really hard to look at and navigate, so I just told it to format it a bit cleaner so I could check if things looked right. 

### Prompt 2

keep all the requirements from my prompt before but for thematics can u follow a theme like this https://bitetoothpastebits.com/ like just something cleaner and also use some yale blue color throughout

## Section 4 — Problem 4: Create account and login

### Prompt 1

okay now for problem 4. build a normal create account/login flow. for create account it needs first name, last name, email, password and a confirm password. for login, email and password. when a new account is created it needs to go in the users table. make sure that passwords are stored securely so that hackers cannot access them. The seed databae already has a test user with email test@campuscustoms.yale.edu and a password. use that to make sure login is working. also confirm that a new account creation works. 
update the output/harness.md file with how auth works like what you store for a user and how passwords are protected

### What I was lacking after the first prompt

I wasn't able to login with the given credentials so my AI had to re-hash for it to work.

### Prompt 2

I'm not able to login with these credentials email: test@campuscustoms.yale.edu and password: password. According to my assignment, i should be able to login with that because its already a part of the db

## Section 5 — Problem 5: PydanticAI agent backend

### Prompt 1

okay now for problem 5. build the shop chatbot as a PydanticAI agent behind FastAPI plugged into the front-end widget. put the api app in backend/main.py - that is the file you run with uvicorn. keep the agent to these four files next to it : 
backend/prompts/prompt.md - system prompt we will grow this file later
backend/agent.py - agent entry and wiring
backend/tools.py - tools the agent can call
backend/models.py - pydantic / pydanticai structured types 

in main.py expose a chat route so that a message from the website returns a reply from the agent and whatever else you need for products or auth. you will need your ai model api key for the agent. 

put campus customs voice and safety basics into prompts/prompt.md (i will expand on tools and safety later). start or update types in models.py for chat replies / product cards as needed. 

in output/harness.md, take note how the front end talks to FastAPI and how the agent is loaded (prompt file and model) 

make sure the backend runs like this from the backend folder
uvicorn main:app --reload --port 8000

### What I was lacking after the first prompt

the backend didn't run when I gave it the command.

### Prompt 2

in the terminal i tried uvicorn main:app --reload --port 8000 but its tell me uvicron not found

## Section 6 — Problem 6: Tools: product info and stock

### Prompt 1

okay now for problem 6. i need to give the agent the tools that look up real information frm the campus_customs.db including the product description, price, and how many are in stock (by size when the customer asks). the agent has to use the database do not invent prices or quantities and if a size is out of stock say so clearly. Expand the exisitng prompts/prompt.md file so the agent knows to call these tools for price and stock questions. add or update return types in models.py . then in output/harness.md list each tool and explain which model fields you chose for lookup results and why

### What I was lacking after the first prompt

the backend was stateless so each message had no memory of its previous turns so I had to ask AI to update that

### Prompt 2

its not telling me if a small size is available when i give it the name after it asks me to tell it the name of the product and i gave it an image

## Section 7 — Problem 7: Chat search that updates the page

### Prompt 1

okay now for problem 7. i want to add this feature - when a customer asks about a type of item like 'what hoodies do you have' the agent should search the catalogue and the website should dynamically show those matching items as product cards (image, name, price, short info). this is an api contract: the agent returns structured product matches and the front end renders them on the website. after the dynamic product cards are loaded by this new feature, make sure the single item behavior functinliaty page built in problem 3 still works. each product card (including the ones that the chat just put on the page) should still open that detialed view (large image and info) when clicked. update prompts/prompt.md and output/harness.md so it is clear how the search results reach the page. don't make things up and also try to keep things efficient as possible

### What I was lacking after the first prompt

Nothing was lacking.

### Prompt 2

n/a

## Section 8 — Problem 8: Customer memory 

### Prompt 1

okay now for problem 8. when a user is loggedin , save their chat history to the database in the appropirate table and reload it when they return. the agent should know who is chatting (name and email) - put that in the agent dependencies (or an equivalent clear pattern) and or tools the agent can call. also pass enough page context that if someone is on a product page and asks "do u have this in pink?" the agent knows which item they mean. Hint - u can put code into the agent context. 
guests can still chat but history only needs to persist for logged in users. 
in output/harness.md, document how user chat history is stored, what customer fields the agent sees, and how page context is passed.

### What I was lacking after the first prompt


### Prompt 2

n/a

## Section 9 — Problem 9: Usability Improvements

### Prompt 1

okay now for problem 9. now i want to improve the app so be creative. Choose 2 front end usability improvements and 2 agent/backend usability improvements. be creative with the front end and overall make it look super professional but creative. front end improvement should be things that make the site look better and make it easier to use. Agent / backend improvements are things that make the agent output better, more accurate, or safer. these improvements could be things like new agent tools or things that make the agent run faster or cheaper. write output/usability.md before or as you build, for each of the improvements say what you added and why it helps a Campus Customs shopper or the business. make sure all improvement obviously show up in the running app. and that they are clearly docuemented in the writeup.

### What I was lacking after the first prompt

After the first prompt, it created features that weren't that interesting. They were very similar to what was already implemented. 

### Prompt 2

can u do a different front end feature instead of ask dan. like u can still keep that but add a different one that more interesting. and then can u also do a different backend feature instead of the sensitive info shield. u can still keep that on the site but like for the usability.md doc puproses and impelentation i want to do something thats more interesting

## Section 10 — Problem 10: Style the website

### Prompt 1

okay now for problem 10. i want to add a bunch of creative design to make it feel like real website. i am inspired by the design of these webistes https://bellakitchenware.com/ https://monolithstudio.com/ https://www.everlane.com/ for some inspo. i want to have more like 3d elements. so maybe u can create a 3d element out of one of the clothing items and have it like move around into a closet similar to the bella one with the toaster moving into the kitchen. also i want it to look like a really professional website but also keep it interesting. i can play around with the fonts colors hierarchy motion product presentation and chat feel. dont change any of the actual core functionality i need to make sure everything from before still works and all the previous requirements are still met

### What I was lacking after the first prompt

my home page ideas were implemented but the products page still needed some work to fit the style of the updated home page. 

### Prompt 2

the home page looks great, but i think the products page could use some improvement. the filter section feels messy and the overall look just isn't as modern and clean. can u make the product page look cooler to fit the vibe of the home page

## Section 11 — Problem 11: Site testing (app check)

### Prompt 1

okay now for problem 11. i want to test the live site and document everything in output/app_check.html which should be page i can double click and open. include clear screenshots and short captions for each of the following - 1. chat checking the invetory level of an item (honest stock / price from the db). 2. the dynamic search result cards appearing after a category question (ex. hoodies). 3. one of the usability features you added in problem 9. 
also its really important to make the html easy to grade: heading for each check, screenshot, one or two sentences on what the screenshot proves. put the screenshot image file in output/app_check_images/ and link them from app_check.html with relative paths (for example app_check_images/inventory.png)

### What I was lacking after the first prompt

nothing was missing 

### Prompt 2

n/a

## Section 12 — Problem 12: Audit trail, safety, finish harness 

### Prompt 1

oaky now for problem 12. keep an append only output/audit_trail.json of agent loop activity like time, tool name, short args/result, stop reason. Do not wipe it between runs. also think of some safety rules to give the agnet and put those in prompts/prompt.md
also finish output/harness.md so it is clear how the system works. make it very clear and easy to follow along and all encompassing. that includes model fields in models.py and why you chose them. tools and abilites. safety rules. spec like loop limits, result caps, models, how to run front and back

### What I was lacking after the first prompt

nothing was missing 

### Prompt 2

n/a