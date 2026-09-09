(function(){
  var form = document.getElementById('enquiry-form');
  var status = document.getElementById('form-status');
  if(!form) return;
  form.addEventListener('submit', function(e){
    e.preventDefault();
    status.textContent = '';
    status.className = 'form-status';
    if(!form.checkValidity()){
      form.reportValidity();
      return;
    }
    var data = Object.fromEntries(new FormData(form).entries());
    if(data.photos) data.photos = true;
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    fetch(form.action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data)
    })
    .then(function(res){
      if(res.ok){
        status.textContent = 'Thanks — your brief is in. We\'ll reply within two business days.';
        status.className = 'form-status ok';
        form.reset();
      } else {
        throw new Error('bad response');
      }
    })
    .catch(function(){
      status.textContent = 'Something went wrong sending your brief. Please email us instead and we\'ll look after you personally.';
      status.className = 'form-status err';
    })
    .finally(function(){ btn.disabled = false; });
  });
})();
