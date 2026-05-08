const importMap = {
  imports: {
    "two.js": "https://esm.sh/two.js@0.8.23",
    "three": "https://esm.sh/three@0.180.0",
    "gsap": "https://esm.sh/gsap@3.13.0",
    "framer-motion": "https://esm.sh/framer-motion@12.23.24"
  }
};

const script = document.createElement('script');
script.type = 'importmap';
script.textContent = JSON.stringify(importMap);
document.head.appendChild(script);
