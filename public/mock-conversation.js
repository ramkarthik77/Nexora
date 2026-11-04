/* Nexora local scripted conversation. All answers are fictional, deterministic,
   and require no external service, user data, keys, or AI model. */
(() => {
  'use strict';
  const questions = Object.freeze([
    { id:'identity', question:'Who are you?', answer:'Hello! I am Nexora, your interactive engineering companion. Right now I am running a scripted demonstration, not an AI model. You can test my voice and facial movement without connecting Claude.' },
    { id:'sites', question:'How many AEM sites do you monitor?', answer:'In this demo, I display one hundred and twenty entirely fictional AEM websites. The numbers and site names are synthetic. There are no live Adobe or company connections.' },
    { id:'deployment', question:'How many production deployments happened this quarter?', answer:'I cannot report a real quarterly production deployment total yet. The simulator shows a handful of invented pipeline executions only. Once an approved data source is connected, we can calculate verified totals.' },
    { id:'incident', question:'Can you show me an incident?', answer:'Certainly. I have switched the AEM simulator to an incident scenario. Two fictional websites are marked down, with a synthetic outage alert. Select AEM Cloud Operations to inspect the details.' },
    { id:'voice', question:'Can you hear me and talk back?', answer:'Yes, for this demonstration! You can ask one of the five scripted questions. I can speak with your device voice, or an optional natural studio voice, while animating my expression. The microphone requires browser speech recognition support and your permission; there is no AI reasoning connected.' },
  ]);
  const clean = input => String(input ?? '').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  function resolve(input) {
    const s=clean(input);
    const exact=questions.find(q=>clean(q.question)===s);
    if(exact)return exact;
    if(/^(who are you|introduce yourself|what is nexora|tell me about yourself)$/.test(s))return questions[0];
    if(/(how many|number of|total).*(sites|websites)/.test(s)||/aem site count/.test(s))return questions[1];
    if(/(deployments|deploys|production releases).*(quarter|three months)/.test(s)||/quarter.*(deployments|deploys)/.test(s))return questions[2];
    if(/(show|simulate|demo|tell me about).*(incident|outage)/.test(s)||/any incidents/.test(s))return questions[3];
    if(/(can you|do you).*(hear|speak|talk|listen)/.test(s)||/test your voice/.test(s))return questions[4];
    return null;
  }
  globalThis.NexoraDemo=Object.freeze({ questions, resolve });
})();
