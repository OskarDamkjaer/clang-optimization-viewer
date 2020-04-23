int* demo(int* s, int c) {
  for(int i = 0; i < 10000; i ++) {
    switch(s[i]) {
      case 0: s[i] = c; break;
      case 1: s[i] = 1; break;
    }
  }
  return s;
}