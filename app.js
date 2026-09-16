(() => {
  'use strict';

  const course = window.ABUNDANT_LIGHT_COURSE;
  if (!course?.editions) {
    document.body.innerHTML = '<p style="padding:2rem">교재 데이터를 읽을 수 없습니다.</p>';
    return;
  }

  const $ = (selector) => document.querySelector(selector);
  const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const labels = {
    ko: {
      course: '성경공부', journey: '20과 성경 여정', contents: '목차', chapters: '과목차',
      lesson: '수업', review: '복습', previous: '이전 과', next: '다음 과',
      download: '내 답 내려받기', storage: '답은 이 기기에 자동 저장됩니다.',
      progress: '작성', saved: '저장됨', empty: '이 단계에는 아직 내용이 없습니다.',
      one: '하나를 선택하세요.', many: '해당하는 답을 모두 선택하세요.',
      short: '답을 적으세요', long: '생각을 자유롭게 적으세요', choose: '답을 연결하세요',
      guide: '참고 답 확인', scripture: '성경 본문', lessonNumber: (n) => `${n}과`, questionNumber: (n) => `${n}번 문제`,
      filename: '풍요로운-빛-내-답.json'
    },
    en: {
      course: 'Bible Study', journey: 'A 20-lesson Bible journey', contents: 'Contents', chapters: 'Lessons',
      lesson: 'Lesson', review: 'Review', previous: 'Previous', next: 'Next',
      download: 'Download my answers', storage: 'Your answers are saved on this device.',
      progress: 'answered', saved: 'Saved', empty: 'There is no content in this section yet.',
      one: 'Select one answer.', many: 'Select all that apply.',
      short: 'Write your answer', long: 'Write your thoughts', choose: 'Choose a match',
      guide: 'Check the answer guide', scripture: 'Scripture', lessonNumber: (n) => `Lesson ${n}`, questionNumber: (n) => `Question ${n}`,
      filename: 'abundant-light-my-answers.json'
    },
    es: {
      course: 'Estudio bíblico', journey: 'Un recorrido bíblico de 20 lecciones', contents: 'Contenido', chapters: 'Lecciones',
      lesson: 'Lección', review: 'Repaso', previous: 'Anterior', next: 'Siguiente',
      download: 'Descargar mis respuestas', storage: 'Tus respuestas se guardan en este dispositivo.',
      progress: 'respondidas', saved: 'Guardado', empty: 'Todavía no hay contenido en esta sección.',
      one: 'Elige una respuesta.', many: 'Elige todas las que correspondan.',
      short: 'Escribe tu respuesta', long: 'Escribe tus pensamientos', choose: 'Elige la relación',
      guide: 'Consultar la respuesta', scripture: 'Texto bíblico', lessonNumber: (n) => `Lección ${n}`, questionNumber: (n) => `Pregunta ${n}`,
      filename: 'luz-abundante-mis-respuestas.json'
    }
  };

  const languageNames = { ko: '한국어', en: 'English', es: 'Español' };
  const storagePrefix = 'abundant-light-reader-v1';
  const supportedLanguages = Object.keys(course.editions);
  let state = readLocation();
  let saveTimer;

  function readLocation() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const language = supportedLanguages.includes(params.get('lang')) ? params.get('lang') : 'ko';
    const chapters = course.editions[language].chapters;
    const chapterId = chapters.some((chapter) => chapter.id === params.get('chapter'))
      ? params.get('chapter') : chapters[0]?.id;
    const stage = params.get('stage') === 'review' ? 'review' : 'lesson';
    return { language, chapterId, stage };
  }

  function edition() { return course.editions[state.language]; }
  function chapter() { return edition().chapters.find((item) => item.id === state.chapterId) || edition().chapters[0]; }
  function ui() { return labels[state.language]; }
  function blocks() { return (chapter()?.blocks || []).filter((block) => block.stage === state.stage); }
  function answerKey(blockId) { return `${storagePrefix}:${course.id}:${state.language}:${chapter().id}:${blockId}`; }
  function readAnswer(blockId) {
    try { return JSON.parse(localStorage.getItem(answerKey(blockId))); } catch { return null; }
  }
  function writeAnswer(blockId, value) {
    try {
      localStorage.setItem(answerKey(blockId), JSON.stringify(value));
      showSaved();
    } catch {
      $('#saveStatus').textContent = ui().storage;
    }
  }
  function showSaved() {
    const status = $('#saveStatus');
    status.textContent = ui().saved;
    status.classList.add('visible');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => status.classList.remove('visible'), 1300);
  }
  function setLocation(replace = false) {
    const hash = `lang=${state.language}&chapter=${state.chapterId}&stage=${state.stage}`;
    history[replace ? 'replaceState' : 'pushState'](null, '', `#${hash}`);
  }

  function leafBlocks(items = blocks()) {
    return items.flatMap((block) => block.type === 'group' ? leafBlocks(block.children || []) : [block]);
  }
  function isInteractive(block) {
    return !['text', 'scripture', 'image', 'group'].includes(block.type);
  }
  function isComplete(block, answer = readAnswer(block.id)) {
    if (!isInteractive(block)) return false;
    if (block.type === 'multiple') return Array.isArray(answer) && answer.length > 0;
    if (block.type === 'blank') return Array.isArray(answer) && answer.length > 0 && answer.every((value) => String(value).trim());
    if (block.type === 'matching') return block.pairs?.length > 0 && block.pairs.every((pair) => answer?.[pair.id]);
    return typeof answer === 'string' && answer.trim().length > 0;
  }
  function chapterCompletion(item) {
    const inputs = leafBlocks(item.blocks || []).filter(isInteractive);
    return inputs.length > 0 && inputs.every((block) => {
      const key = `${storagePrefix}:${course.id}:${state.language}:${item.id}:${block.id}`;
      let answer = null;
      try { answer = JSON.parse(localStorage.getItem(key)); } catch {}
      return isComplete(block, answer);
    });
  }

  function embeddedNumber(block) {
    const match = String(block.prompt || '').trim().match(/^(\d+)\s*[.)、:]\s*/);
    return match ? Number(match[1]) : null;
  }
  function blockNumber(block, fallback) {
    return block.number || embeddedNumber(block) || fallback;
  }
  function cleanPrompt(block, isChild = false) {
    let prompt = String(block.prompt || '').trim();
    if (block.number || embeddedNumber(block)) prompt = prompt.replace(/^\d+\s*[.)、:]\s*/, '');
    if (isChild) prompt = prompt.replace(/^[A-Z]\s*[.)、:]\s*/i, '');
    return prompt;
  }
  function answerGuide(block) {
    if (String(block.answer || '').trim()) return block.answer;
    if (['single', 'multiple'].includes(block.type)) {
      return (block.options || []).filter((option) => (block.correct || []).includes(option.id)).map((option) => option.text).join(' / ');
    }
    if (block.type === 'matching') return (block.pairs || []).map((pair) => `${pair.left} → ${pair.right}`).join('\n');
    return '';
  }
  function guideHTML(block) {
    const answer = answerGuide(block);
    return answer ? `<details class="answer-guide"><summary>${escapeHTML(ui().guide)}</summary><p>${escapeHTML(answer)}</p></details>` : '';
  }
  function metaHTML(block) {
    const items = [];
    if (block.reference) items.push(block.reference);
    if (block.help) items.push(block.help);
    return items.length ? `<div class="question-meta">${items.map((item) => `<span>${escapeHTML(item)}</span>`).join('')}</div>` : '';
  }

  function inputHTML(block, isChild = false) {
    const answer = readAnswer(block.id);
    const prompt = cleanPrompt(block, isChild);
    if (['single', 'multiple'].includes(block.type)) {
      const current = Array.isArray(answer) ? answer : answer ? [answer] : [];
      const inputType = block.type === 'single' ? 'radio' : 'checkbox';
      return `<p class="prompt">${escapeHTML(prompt)}</p><p class="question-meta"><span>${escapeHTML(block.type === 'single' ? ui().one : ui().many)}</span></p>
        <div class="choice-list">${(block.options || []).map((option) => `<label class="choice"><input type="${inputType}" name="answer-${escapeHTML(block.id)}" data-answer="${escapeHTML(block.id)}" value="${escapeHTML(option.id)}" ${current.includes(option.id) ? 'checked' : ''}><span>${escapeHTML(option.text)}</span></label>`).join('')}</div>`;
    }
    if (block.type === 'blank') {
      let slot = 0;
      const escaped = escapeHTML(prompt).replace(/_{2,}/g, () => {
        const value = Array.isArray(answer) ? answer[slot] || '' : '';
        return `<input class="blank-input" data-answer="${escapeHTML(block.id)}" data-slot="${slot++}" value="${escapeHTML(value)}" autocomplete="off" aria-label="${escapeHTML(ui().short)}">`;
      });
      if (slot === 0) {
        return `<p class="prompt">${escaped}</p><div class="answer-area"><input class="text-answer" data-answer="${escapeHTML(block.id)}" value="${escapeHTML(typeof answer === 'string' ? answer : '')}" placeholder="${escapeHTML(ui().short)}" autocomplete="off"></div>`;
      }
      return `<p class="blank-sentence">${escaped}</p>`;
    }
    if (block.type === 'matching') {
      const values = answer && typeof answer === 'object' ? answer : {};
      const pairs = block.pairs || [];
      const choices = pairs.length > 1 ? [...pairs.slice(1), pairs[0]] : pairs;
      return `<p class="prompt">${escapeHTML(prompt)}</p><div class="answer-area matching-list">${pairs.map((pair) => `<label class="matching-row"><span>${escapeHTML(pair.left)}</span><select data-answer="${escapeHTML(block.id)}" data-pair="${escapeHTML(pair.id)}"><option value="">${escapeHTML(ui().choose)}</option>${choices.map((choice) => `<option value="${escapeHTML(choice.id)}" ${values[pair.id] === choice.id ? 'selected' : ''}>${escapeHTML(choice.right)}</option>`).join('')}</select></label>`).join('')}</div>`;
    }
    const long = block.type === 'long';
    return `<label><span class="prompt">${escapeHTML(prompt)}</span><div class="answer-area">${long
      ? `<textarea class="long-answer" data-answer="${escapeHTML(block.id)}" rows="3" placeholder="${escapeHTML(ui().long)}">${escapeHTML(typeof answer === 'string' ? answer : '')}</textarea>`
      : `<input class="text-answer" data-answer="${escapeHTML(block.id)}" value="${escapeHTML(typeof answer === 'string' ? answer : '')}" placeholder="${escapeHTML(ui().short)}" autocomplete="off">`}</div></label>`;
  }

  function blockHTML(block, index, childIndex = null) {
    if (block.type === 'image') {
      return `<section class="question-card content-card"><p class="supporting-text">${escapeHTML(cleanPrompt(block))}</p>${block.image ? `<img class="question-image" src="${escapeHTML(block.image)}" alt="${escapeHTML(block.alt || block.prompt || '')}" loading="lazy">` : ''}</section>`;
    }
    if (['text', 'scripture'].includes(block.type)) {
      return `<section class="question-card content-card">${block.type === 'scripture' ? `<p class="question-number">${escapeHTML(ui().scripture)}</p>` : ''}<p class="supporting-text">${escapeHTML(cleanPrompt(block))}</p>${metaHTML(block)}</section>`;
    }
    if (block.type === 'group') {
      const number = blockNumber(block, index);
      return `<section class="question-card group-card" data-question="${escapeHTML(block.id)}">
        ${number ? `<p class="question-number">${escapeHTML(ui().questionNumber(number))}</p>` : ''}
        ${cleanPrompt(block) ? `<p class="prompt">${escapeHTML(cleanPrompt(block))}</p>` : ''}${metaHTML(block)}
        <div class="subquestions">${(block.children || []).map((child, childPosition) => `<div class="subquestion" data-question="${escapeHTML(child.id)}" data-complete="${isComplete(child)}"><span class="subquestion-label">${escapeHTML(child.label || String.fromCharCode(65 + childPosition))}</span>${inputHTML(child, true)}${metaHTML(child)}${guideHTML(child)}</div>`).join('')}</div>
      </section>`;
    }
    const number = blockNumber(block, index);
    return `<section class="question-card" data-question="${escapeHTML(block.id)}" data-complete="${isComplete(block)}">
      ${number ? `<p class="question-number">${escapeHTML(ui().questionNumber(number))}</p>` : ''}
      ${inputHTML(block)}${metaHTML(block)}${guideHTML(block)}
    </section>`;
  }

  function renderChapterList() {
    $('#chapterList').innerHTML = edition().chapters.map((item, index) => `<button class="chapter-link" type="button" data-chapter="${escapeHTML(item.id)}" ${item.id === chapter().id ? 'aria-current="page"' : ''}><span class="chapter-index">${String(index + 1).padStart(2, '0')}</span><span class="chapter-name">${escapeHTML(item.title)}</span><span class="chapter-check" aria-label="${chapterCompletion(item) ? ui().progress : ''}">${chapterCompletion(item) ? '✓' : ''}</span></button>`).join('');
    document.querySelectorAll('[data-chapter]').forEach((button) => button.addEventListener('click', () => {
      state.chapterId = button.dataset.chapter;
      state.stage = 'lesson';
      setLocation();
      closeContents();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
  }

  function renderProgress() {
    const inputs = leafBlocks().filter(isInteractive);
    const completed = inputs.filter((block) => isComplete(block)).length;
    const percent = inputs.length ? Math.round(completed / inputs.length * 100) : 0;
    $('#chapterProgress').innerHTML = `<strong>${completed} / ${inputs.length}</strong><small>${escapeHTML(ui().progress)}</small><div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${percent}%"></div></div>`;
  }

  function render() {
    const currentChapter = chapter();
    if (!currentChapter) return;
    document.documentElement.lang = state.language;
    document.title = `${currentChapter.title} · ${edition().title}`;
    $('#language').value = state.language;
    $('#courseTitle').textContent = edition().title;
    $('#courseLabel').textContent = ui().course;
    $('#courseKicker').textContent = ui().journey;
    $('#chaptersHeading').textContent = ui().chapters;
    $('#contentsLabel').textContent = ui().contents;
    $('#downloadAnswers').textContent = ui().download;
    $('#storageNote').textContent = ui().storage;
    const chapterIndex = edition().chapters.indexOf(currentChapter);
    $('#lessonNumber').textContent = ui().lessonNumber(chapterIndex + 1);
    $('#lessonTitle').textContent = currentChapter.title;
    $('#lessonDescription').textContent = currentChapter.description || '';
    $('#lessonTab').textContent = ui().lesson;
    $('#reviewTab').textContent = ui().review;
    $('#lessonTab').setAttribute('aria-selected', state.stage === 'lesson');
    $('#reviewTab').setAttribute('aria-selected', state.stage === 'review');
    let questionIndex = 0;
    $('#questionList').innerHTML = blocks().length
      ? blocks().map((block) => blockHTML(block, isInteractive(block) || block.type === 'group' ? ++questionIndex : null)).join('')
      : `<div class="empty-state">${escapeHTML(ui().empty)}</div>`;
    $('#previousChapter span').textContent = ui().previous;
    $('#nextChapter span').textContent = ui().next;
    $('#previousChapter').disabled = chapterIndex === 0;
    $('#nextChapter').disabled = chapterIndex === edition().chapters.length - 1;
    renderChapterList();
    renderProgress();
    bindAnswers();
    autoGrow();
  }

  function bindAnswers() {
    document.querySelectorAll('[data-answer]').forEach((input) => input.addEventListener('input', () => {
      const blockId = input.dataset.answer;
      const block = leafBlocks().find((item) => item.id === blockId);
      if (!block) return;
      let value;
      const controls = [...document.querySelectorAll(`[data-answer="${CSS.escape(blockId)}"]`)];
      if (block.type === 'multiple') value = controls.filter((control) => control.checked).map((control) => control.value);
      else if (block.type === 'single') value = input.value;
      else if (block.type === 'blank' && controls.some((control) => control.dataset.slot !== undefined)) value = controls.map((control) => control.value);
      else if (block.type === 'matching') value = Object.fromEntries(controls.map((control) => [control.dataset.pair, control.value]));
      else value = input.value;
      writeAnswer(blockId, value);
      const card = input.closest('[data-question]');
      if (card) card.dataset.complete = String(isComplete(block, value));
      renderProgress();
      renderChapterList();
      if (input.tagName === 'TEXTAREA') grow(input);
    }));
  }

  function grow(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(100, textarea.scrollHeight)}px`;
  }
  function autoGrow() { document.querySelectorAll('textarea').forEach(grow); }
  function closeContents() {
    $('#chapterPanel').classList.remove('open');
    $('#contentsToggle').setAttribute('aria-expanded', 'false');
  }
  function moveChapter(delta) {
    const chapters = edition().chapters;
    const index = chapters.indexOf(chapter());
    if (!chapters[index + delta]) return;
    state.chapterId = chapters[index + delta].id;
    state.stage = 'lesson';
    setLocation();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function download(filename, data) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  function exportAnswers() {
    const responses = [];
    edition().chapters.forEach((item) => {
      leafBlocks(item.blocks || []).filter(isInteractive).forEach((block) => {
        const key = `${storagePrefix}:${course.id}:${state.language}:${item.id}:${block.id}`;
        const raw = localStorage.getItem(key);
        if (raw === null) return;
        let response;
        try { response = JSON.parse(raw); } catch { return; }
        responses.push({ chapter: item.title, chapterId: item.id, questionId: block.id, prompt: block.prompt, type: block.type, response });
      });
    });
    download(ui().filename, JSON.stringify({ schema: 1, course: edition().title, language: state.language, exportedAt: new Date().toISOString(), responses }, null, 2));
  }

  $('#language').addEventListener('change', (event) => {
    const oldIndex = edition().chapters.indexOf(chapter());
    state.language = event.target.value;
    state.chapterId = edition().chapters[Math.max(0, oldIndex)]?.id || edition().chapters[0]?.id;
    setLocation();
    render();
  });
  $('#contentsToggle').addEventListener('click', () => {
    const open = $('#chapterPanel').classList.toggle('open');
    $('#contentsToggle').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (event) => {
    if (innerWidth <= 900 && $('#chapterPanel').classList.contains('open') && !event.target.closest('#chapterPanel') && !event.target.closest('#contentsToggle')) closeContents();
  });
  $('#lessonTab').addEventListener('click', () => { state.stage = 'lesson'; setLocation(); render(); });
  $('#reviewTab').addEventListener('click', () => { state.stage = 'review'; setLocation(); render(); });
  $('#previousChapter').addEventListener('click', () => moveChapter(-1));
  $('#nextChapter').addEventListener('click', () => moveChapter(1));
  $('#downloadAnswers').addEventListener('click', exportAnswers);
  window.addEventListener('hashchange', () => { state = readLocation(); render(); });

  setLocation(true);
  render();
})();
