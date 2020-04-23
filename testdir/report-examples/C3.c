int f(int b);

int demo(int* a, int* b) {
    int sum = 0;
    for (int i = 1; i < 1000; i++)
    {
      if (a[i] > 2) {
         sum += a[i];
      } else {
         sum += f(0);
      }
    }
    return sum;
}
