
const menuBtn=document.querySelector('.menu-btn');
const mobileLinks=document.querySelector('.mobile-links');
if(menuBtn&&mobileLinks){menuBtn.addEventListener('click',()=>{const opened=mobileLinks.classList.toggle('open');menuBtn.setAttribute('aria-expanded',String(opened));menuBtn.textContent=opened?'×':'☰';});}
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
const search=document.querySelector('#stockSearch'),category=document.querySelector('#stockCategory');
function filterStock(){const q=(search?.value||'').toLowerCase();const c=category?.value||'all';let shown=0;document.querySelectorAll('.stock-card').forEach(card=>{const ok=(card.dataset.name||'').includes(q)&&(c==='all'||card.dataset.category===c);card.style.display=ok?'block':'none';if(ok)shown++;});const empty=document.querySelector('#noStock');if(empty)empty.hidden=shown!==0;}
if(search)search.addEventListener('input',filterStock);if(category)category.addEventListener('change',filterStock);
const form=document.querySelector('#contactForm');if(form)form.addEventListener('submit',e=>{e.preventDefault();const data=new FormData(form);const subject=encodeURIComponent('Website enquiry - '+data.get('name'));const body=encodeURIComponent('Name: '+data.get('name')+'\nEmail: '+data.get('email')+'\n\n'+data.get('message'));location.href='mailto:village.vgn@gmail.com?subject='+subject+'&body='+body;});
