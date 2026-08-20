---
title: Wiki-Brain
slug: wiki-brain
date: 2026-08-20
dek: Recreating Your Mind
tags: 
kana: 通信
tone: 2
---

The wiki-brain project that is hosted here is my spin on the Karpathy Personal LLM Wiki which was first laid out in a 2026 blog post by Anthropic's Andrej Karpathy.

Karpathy's system lays the fundamental groundwork for an archive of consumed information (articles, podcasts, books etc) which reflects the users own knowledge base and most importantly, which documents the analysis of that information to save inference and time when it needs to be recalled.

Put simply, rather than re-running your LLM over a question you've already answered or one which relies on that analysis output to generate a new synthesis...you store all of that information in the wiki.

The wiki-brain I have built takes that idea and gives it a lit meth pipe to make it the most data-rich and intensive version of the idea.

Doing this requires the willingness to completely abandon not only the most fundamental privacy concerns by doing things like gathering and publicly listing every piece of data you can retrieve about yourself in a GitHub repository... but it takes quite a bit of restraint to not skew data and conclusions which is unfavorable or less than ideal in how it paints the creator of the wiki. 

This experiment is currently abiut 45 days old and has just crossed 640 commits. 

The initial infrastructure was built by fable 5 and since then it has been primarily been maintained and grown using Opus 5 ultracode. Recently I have begun to implement Hermes agent using the free longcat2 model in parallel with Claude to delegate the less difficult tasks to a free model. 

Watch this space
