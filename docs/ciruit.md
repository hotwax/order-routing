# Circuit

Circuit is an assistant that helps to setup order routing rules by learning what their omnichannel routing objectives are.

## How it works

### Learning

Circuit learns how a retailer optimizes their omnichannel routing strategy by starting with a set of interactive questions. These questions are designed to understand the retailer's business objectives, such as minimizing inventory costs, maximizing order fulfillment efficiency, and ensuring customer satisfaction. Based on the retailer's responses, Circuit can recommend the most appropriate order routing rules to achieve their objectives.

To ensure it has actually learned the retailer's objectives, Circuit will ask the retailer to ask it questions to confirm its understanding.

If the retailer is not satisfied with the recommendations, Circuit will adjust its internal ruberic of knowledge confidence and synthsize addiitional questions to learn more about the retailer.

### Building

Once trained, retailers can talk to Circuit in their own language to build their order routing rules. Circuit will use the knowledge it has learned to recommend the most appropriate order routing rules to achieve the retailer's objectives. The chat interface to build routing rules will be broken up into two main parts, a chat window and a canvas where the user can follow along with Circuit's recommendations and see the routing rules being built.

Circuit's goal is not to block or consult on routing strategies but to help execute. Much like the character from the Bollywood films series "Munna Bhai", its job is to not ask questions but to just help the user move fast.

There will be a wide variety of tools avaiable to Circuit that allow it to find critical information needed to build routing rules. In addition to the tools needed to simply create routing groups, rules and inventory rules, Circuit will also have access to tools that allow it to find data like facilities based on geography, sales velocity, rejection rate, and then create and update data like facility groups and set order limits.

Functions Circuit can call:
Starting with something simple, the bot will have access to one function that is to update a routing, and the user will use it to just update the routing rule status. Since the model is running locally, there is no MCP, we instead need a different way 

## Implementation

### Frontend

A new page will be added to the main tabs navigation bar. The first time a retailer opens the agent, they will be introduced to the concept of circuit and prompted to share their order routing strategies. There will also be a section that provides data privacy details like the fact that all chat history is stored encrypted, their data is stored on a dedicated database and that the retailer can delete their data at any time.

If the user decides to proceed, they'll be taken to a chat interface where they can talk to Circuit to teach it about their omnichannel routing objectives and either Circuit will let them know that it has learned enough or the retailer can decide to force skip to the next step and come back later at anytime.

Once the retailer has completed the learning process, they'll be taken to a canvas where they can build their order routing rules. The canvas will be broken up into two main parts, a chat window and a canvas where the user can follow along with Circuit's recommendations and see the routing rules being built. The chat window will have two main elements, the chat history and the message input area.

When inputting a message, the user can decide to also attach context from their existing routing rules setup. This will direct Circuit to focus it's changes specifically in the context provided and not deviate to other areas of the routing rules.

In the chat history, the user will see their prompts and Circuit's responses. The chat history will also show any context that was attached to the message as well as observability compoenents whenever the agent is using tools to find information needed to build routing rules or has a chain of thought.

The user can then also switch to old threads or start a new thread when they want a fresh start and work on a new topic. Previous chat threads can be browsed by using the "threads" button in the top right corner of the window. Each chat will have an auto generated name based on the first few words of the chat.

**Canvas**

The canvas is where the user can see the routing rules that Circuit has built for them. What is shown on the canvas is dynamic based on what the Circuit is currently working on. For example, if Circuit is working on building routing groups, the canvas will show the routing groups that Circuit has built for them. If Circuit is working on building routing rules, the canvas will show the routing group and routing rules that Circuit has built for them. If Circuit is working on building inventory rules, the canvas will show the routing rules, highlighting the selected rule, and then the inventory rules that Circuit has built for them.

At a time the canvas will always present at most 3 levels of data. For example, if Circuit is working on building routing groups, the canvas will show the routing groups that Circuit has built for them. If Circuit is working on building routing rules, the canvas will show the routing group and routing rules that Circuit has built for them. If Circuit is working on building inventory rules, the canvas will show the routing rules, highlighting the selected rule, and then the inventory rules that Circuit has built for them. The goal is to always provide context or visual breadcrumbs of where the user is in the larger context of their routing rules.

The canvas itself is not view only, the user is able to click through it and make changes to the routing rules. For example, if Circuit is working on building routing groups, the canvas will show the routing groups that Circuit has built for them. If the user clicks on a routing group, the canvas will show the routing rules that Circuit has built for them.

To load details into the canvas, the component will accept the routing rule id that the user wants to edit. It will then fetch the routing rule and all of its parent data (routing groups, inventory rules, etc.) and display it on the canvas. 