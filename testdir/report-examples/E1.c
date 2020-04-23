struct node 
{
    struct node* next; 
};

void demo(struct node* n) {
    while (n->next)
    {
        n = n->next;   
    }
}
